-- ============================================================================
-- MIGRACIÓN 0001 — Fundación de Tenancy (Fase 0, Sesión 1 · DOC3 §1, DOC12)
-- ============================================================================
-- Contenido: tenants, units, users (ancla), roles/permissions, memberships,
-- tenant_modules, tenant_counters + helpers RLS + hook JWT + RPCs de
-- aprovisionamiento. Todo lo demás (domain_events, jobs, notifications,
-- audit_log) llega en migraciones 0002+ según el plan de sesiones.
--
-- PASOS MANUALES tras aplicar (una sola vez):
--   1. Supabase Dashboard → Authentication → Hooks → "Custom Access Token"
--      → seleccionar public.custom_access_token_hook. Sin esto el claim
--      tenant_id no viaja en el JWT y las políticas devuelven vacío.
--   2. El cliente DEBE refrescar la sesión (supabase.auth.refreshSession())
--      después de app.set_active_tenant() o app.provision_tenant().
--   3. Con Supabase CLI, renombrar a la convención con timestamp:
--      supabase/migrations/2026XXXXXXXXXX_tenancy_foundation.sql
--   4. Seeds de desarrollo: NO aquí; van en supabase/seed.sql.
--
-- Invariantes que esta migración establece (CLAUDE.md reglas 1, 2, 9, 10):
--   · Toda tabla de negocio futura: tenant_id NOT NULL + app.enable_tenant_isolation()
--   · Folios/correlativos: SOLO app.next_counter()
--   · service_role únicamente en webhooks/jobs/seeds
-- ============================================================================

create extension if not exists pgcrypto;

-- Esquema interno para helpers (fuera de la superficie PostgREST por defecto)
create schema if not exists app;
grant usage on schema app to authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- 0. Utilidades
-- ----------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 1. TENANTS
-- ----------------------------------------------------------------------------
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique
              check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  name        text not null check (length(name) between 2 and 120),
  plan        text not null default 'trial',
  status      text not null default 'active'
              check (status in ('active','suspended','cancelled')),
  -- Config de negocio por tenant (CLAUDE.md regla 7). Baseline SV; editable.
  settings    jsonb not null default jsonb_build_object(
                'timezone','America/El_Salvador',
                'currency','USD',
                'locale','es-SV',
                'country','SV',
                'tax_rate',0.13
              ),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.tenants is
  'Empresa cliente de la plataforma. Ninguna tabla de negocio existe fuera de un tenant.';

create trigger trg_tenants_updated_at
  before update on public.tenants
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. UNITS (marca / sede / CD / sucursal — DOC5 §3.1)
-- ----------------------------------------------------------------------------
create table public.units (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  slug        text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,46}[a-z0-9]$'),
  name        text not null,
  theme       jsonb not null default '{}'::jsonb,   -- colores/branding por unidad (patrón ADEC)
  settings    jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index idx_units_tenant on public.units (tenant_id);

create trigger trg_units_updated_at
  before update on public.units
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. USERS (perfil ancla 1:1 con auth.users — patrón P1)
-- ----------------------------------------------------------------------------
create table public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  full_name         text,
  avatar_url        text,
  locale            text not null default 'es-SV',
  active_tenant_id  uuid references public.tenants(id) on delete set null,
  is_platform_admin boolean not null default false,  -- soporte de plataforma; SIN bypass RLS en v1
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_users_active_tenant on public.users (active_tenant_id);

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function app.set_updated_at();

-- Alta automática de perfil al crear usuario en Auth (patrón donantes)
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ----------------------------------------------------------------------------
-- 4. ROLES y PERMISOS (RBAC por tenant — DOC3 §2)
--    El catálogo de permission_keys vive en los manifests (código);
--    convención: 'mXX.recurso.accion' | 'core.recurso.accion' | 'mXX.*' | '*'
-- ----------------------------------------------------------------------------
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  name        text not null,
  is_system   boolean not null default false,  -- roles de fábrica del bundle: no borrables
  created_at  timestamptz not null default now(),
  unique (tenant_id, key)
);
create index idx_roles_tenant on public.roles (tenant_id);

create table public.role_permissions (
  role_id        uuid not null references public.roles(id) on delete cascade,
  permission_key text not null check (permission_key = '*' or permission_key ~ '^[a-z0-9]+(\.[a-z0-9_]+)*(\.\*)?$'),
  primary key (role_id, permission_key)
);

-- ----------------------------------------------------------------------------
-- 5. MEMBERSHIPS (usuario ↔ tenant; kind='external' = identidad de portal)
-- ----------------------------------------------------------------------------
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role_id     uuid not null references public.roles(id) on delete restrict,
  kind        text not null default 'staff' check (kind in ('staff','external')),
  status      text not null default 'active' check (status in ('active','invited','suspended')),
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index idx_memberships_user   on public.memberships (user_id);
create index idx_memberships_tenant on public.memberships (tenant_id);

-- ----------------------------------------------------------------------------
-- 6. TENANT_MODULES (activación self-service — DOC7 §4)
--    La validación de dependencias HARD la hace la capa de aplicación
--    leyendo los manifests; aquí solo persistencia + guardas básicas.
-- ----------------------------------------------------------------------------
create table public.tenant_modules (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  module_key   text not null check (module_key ~ '^(core|m[0-9]{2}-[a-z0-9-]+|v[0-9]-[a-z0-9-]+)$'),
  status       text not null default 'active' check (status in ('active','suspended')),
  config       jsonb not null default '{}'::jsonb,
  activated_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, module_key)
);

create trigger trg_tenant_modules_updated_at
  before update on public.tenant_modules
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. TENANT_COUNTERS (folios/correlativos — CLAUDE.md regla 2)
--    Sin acceso directo por API: RLS habilitado SIN políticas; solo la
--    función app.next_counter (security definer) lo toca.
-- ----------------------------------------------------------------------------
create table public.tenant_counters (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  key        text not null check (key ~ '^[a-z0-9_.-]{2,60}$'),
  value      bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- ----------------------------------------------------------------------------
-- 8. HELPERS DE AUTORIZACIÓN (usados por TODAS las políticas RLS)
--    SECURITY DEFINER para evitar recursión de RLS (patrón es_admin/INNOLATTE)
-- ----------------------------------------------------------------------------
create or replace function app.current_tenant_id()
returns uuid language sql stable as $$
  select nullif(coalesce(auth.jwt()->>'tenant_id',''),'')::uuid
$$;

create or replace function app.is_member(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant and m.user_id = auth.uid() and m.status = 'active'
  )
$$;

-- true si el usuario comparte al menos un tenant activo con p_other
create or replace function app.shares_tenant(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on b.tenant_id = a.tenant_id
    where a.user_id = auth.uid() and b.user_id = p_other
      and a.status = 'active' and b.status = 'active'
  )
$$;

-- Permisos con comodines: '*' (todo) y 'mXX.*' (módulo completo)
create or replace function app.has_permission(p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.user_id = auth.uid()
      and m.tenant_id = app.current_tenant_id()
      and m.status = 'active'
      and (
        rp.permission_key = '*'
        or rp.permission_key = p_perm
        or (rp.permission_key like '%.*'
            and p_perm like replace(rp.permission_key, '*', '') || '%')
      )
  )
$$;

create or replace function app.is_module_active(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenant_modules tm
    where tm.tenant_id = app.current_tenant_id()
      and tm.module_key = p_module and tm.status = 'active'
  )
$$;

grant execute on function
  app.current_tenant_id(), app.is_member(uuid), app.shares_tenant(uuid),
  app.has_permission(text), app.is_module_active(text)
to authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- 9. HOOK JWT — inyecta tenant_id en el access token
--    (Habilitar en Dashboard → Authentication → Hooks; ver cabecera)
--    Solo emite el claim si existe membresía ACTIVA sobre active_tenant_id:
--    un active_tenant_id manipulado jamás produce un claim válido.
-- ----------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  claims   jsonb := coalesce(event->'claims', '{}'::jsonb);
  v_tenant uuid;
begin
  select u.active_tenant_id into v_tenant
  from public.users u
  join public.memberships m
    on m.user_id = u.id
   and m.tenant_id = u.active_tenant_id
   and m.status = 'active'
  where u.id = (event->>'user_id')::uuid;

  if v_tenant is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end $$;

-- Grants requeridos por Supabase Auth para ejecutar el hook
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on public.users, public.memberships to supabase_auth_admin;

-- ----------------------------------------------------------------------------
-- 10. PLANTILLA RLS REUTILIZABLE (CLAUDE.md regla 10)
--     Toda tabla de negocio futura llama a esta función en su migración:
--       select app.enable_tenant_isolation('public.mi_tabla');
--     Baseline permisivo por tenant; los permisos finos van en las server
--     actions (requirePermission) + políticas adicionales del módulo.
-- ----------------------------------------------------------------------------
create or replace function app.enable_tenant_isolation(p_table regclass)
returns void language plpgsql as $$
begin
  execute format('alter table %s enable row level security', p_table);
  execute format(
    'create policy ti_select on %s for select to authenticated using (app.is_member(tenant_id))',
    p_table);
  execute format(
    'create policy ti_insert on %s for insert to authenticated with check (tenant_id = app.current_tenant_id())',
    p_table);
  execute format(
    'create policy ti_update on %s for update to authenticated using (tenant_id = app.current_tenant_id()) with check (tenant_id = app.current_tenant_id())',
    p_table);
  execute format(
    'create policy ti_delete on %s for delete to authenticated using (tenant_id = app.current_tenant_id())',
    p_table);
end $$;

-- ----------------------------------------------------------------------------
-- 11. RLS DE LAS TABLAS DEL CORE (políticas a medida, no plantilla)
-- ----------------------------------------------------------------------------

-- tenants: ver los propios; editar con permiso; crear SOLO vía provision_tenant
alter table public.tenants enable row level security;
create policy tenants_select on public.tenants
  for select to authenticated using (app.is_member(id));
create policy tenants_update on public.tenants
  for update to authenticated
  using (id = app.current_tenant_id() and app.has_permission('core.tenant.manage'))
  with check (id = app.current_tenant_id());

-- units
alter table public.units enable row level security;
create policy units_select on public.units
  for select to authenticated using (app.is_member(tenant_id));
create policy units_write on public.units
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.has_permission('core.units.manage'))
  with check (tenant_id = app.current_tenant_id() and app.has_permission('core.units.manage'));

-- users: verse a sí mismo y a compañeros de tenant; editar solo el propio perfil
alter table public.users enable row level security;
create policy users_select on public.users
  for select to authenticated using (id = auth.uid() or app.shares_tenant(id));
create policy users_update_self on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy users_auth_admin_read on public.users
  for select to supabase_auth_admin using (true);

-- roles
alter table public.roles enable row level security;
create policy roles_select on public.roles
  for select to authenticated using (app.is_member(tenant_id));
create policy roles_insert on public.roles
  for insert to authenticated
  with check (tenant_id = app.current_tenant_id() and app.has_permission('core.roles.manage'));
create policy roles_update on public.roles
  for update to authenticated
  using (tenant_id = app.current_tenant_id() and app.has_permission('core.roles.manage'))
  with check (tenant_id = app.current_tenant_id());
create policy roles_delete on public.roles
  for delete to authenticated
  using (tenant_id = app.current_tenant_id()
         and app.has_permission('core.roles.manage')
         and is_system = false);

-- role_permissions (tenant vía join a roles)
alter table public.role_permissions enable row level security;
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (exists (select 1 from public.roles r
                 where r.id = role_id and app.is_member(r.tenant_id)));
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (exists (select 1 from public.roles r
                 where r.id = role_id
                   and r.tenant_id = app.current_tenant_id()
                   and app.has_permission('core.roles.manage')))
  with check (exists (select 1 from public.roles r
                      where r.id = role_id
                        and r.tenant_id = app.current_tenant_id()
                        and app.has_permission('core.roles.manage')));

-- memberships
alter table public.memberships enable row level security;
create policy memberships_select on public.memberships
  for select to authenticated using (app.is_member(tenant_id));
create policy memberships_write on public.memberships
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.has_permission('core.members.manage'))
  with check (tenant_id = app.current_tenant_id() and app.has_permission('core.members.manage'));
create policy memberships_auth_admin_read on public.memberships
  for select to supabase_auth_admin using (true);

-- tenant_modules
alter table public.tenant_modules enable row level security;
create policy tenant_modules_select on public.tenant_modules
  for select to authenticated using (app.is_member(tenant_id));
create policy tenant_modules_write on public.tenant_modules
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.has_permission('core.modules.manage'))
  with check (tenant_id = app.current_tenant_id() and app.has_permission('core.modules.manage'));

-- tenant_counters: RLS sin políticas = negado a todos por API.
-- Único acceso: app.next_counter (security definer).
alter table public.tenant_counters enable row level security;

-- ----------------------------------------------------------------------------
-- 11.b GRANTS BASE (paridad con los default privileges de la plataforma)
--      En Supabase hosted, las tablas creadas como `postgres` heredan grants
--      para anon/authenticated/service_role vía ALTER DEFAULT PRIVILEGES; en
--      el stack local/CI las migraciones corren con otro rol y esos defaults
--      NO aplican (lo descubrió el test de aislamiento en CI). Grants
--      explícitos = mismo comportamiento en todo entorno; la seguridad real
--      la imponen las políticas RLS de la sección 11.
-- ----------------------------------------------------------------------------
grant select, insert, update, delete
  on public.tenants, public.units, public.users, public.roles,
     public.role_permissions, public.memberships, public.tenant_modules,
     public.tenant_counters
  to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 12. FUNCIONES DE NEGOCIO DEL CORE
-- ----------------------------------------------------------------------------

-- Folio/correlativo atómico por tenant (upsert incremental en un statement).
-- Primera llamada devuelve p_start; siguientes, +1. Guard de membresía salvo
-- service_role (webhooks/jobs).
create or replace function app.next_counter(p_tenant uuid, p_key text, p_start bigint default 1)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_value bigint;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role'
     and not app.is_member(p_tenant) then
    raise exception 'next_counter: caller is not a member of tenant %', p_tenant
      using errcode = '42501';
  end if;

  insert into public.tenant_counters as tc (tenant_id, key, value, updated_at)
  values (p_tenant, p_key, p_start, now())
  on conflict (tenant_id, key)
  do update set value = tc.value + 1, updated_at = now()
  returning value into v_value;

  return v_value;
end $$;
grant execute on function app.next_counter(uuid, text, bigint) to authenticated, service_role;

-- Aprovisionamiento self-service: tenant + rol owner('*') + membresía + core activo.
-- (Registro DOC12 sesión 6 llama a esto tras el sign-up.)
create or replace function app.provision_tenant(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_tenant uuid;
  v_role   uuid;
begin
  if v_user is null then
    raise exception 'provision_tenant: authentication required' using errcode = '42501';
  end if;

  insert into public.tenants (name, slug) values (p_name, p_slug)
  returning id into v_tenant;

  insert into public.roles (tenant_id, key, name, is_system)
  values (v_tenant, 'owner', 'Propietario', true)
  returning id into v_role;

  insert into public.role_permissions (role_id, permission_key)
  values (v_role, '*');

  insert into public.memberships (tenant_id, user_id, role_id, kind, status)
  values (v_tenant, v_user, v_role, 'staff', 'active');

  insert into public.tenant_modules (tenant_id, module_key)
  values (v_tenant, 'core');

  update public.users set active_tenant_id = v_tenant where id = v_user;

  return v_tenant;
end $$;
grant execute on function app.provision_tenant(text, text) to authenticated;

-- Cambio de tenant activo (multi-tenant por usuario). El cliente refresca sesión después.
create or replace function app.set_active_tenant(p_tenant uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not app.is_member(p_tenant) then
    raise exception 'set_active_tenant: not a member of tenant %', p_tenant
      using errcode = '42501';
  end if;
  update public.users set active_tenant_id = p_tenant where id = auth.uid();
end $$;
grant execute on function app.set_active_tenant(uuid) to authenticated;

-- ============================================================================
-- VERIFICACIÓN RÁPIDA (manual, en SQL editor con dos usuarios de prueba):
--   1. Como usuario A: select app.provision_tenant('Demo A','demo-a');
--   2. Refrescar sesión de A → select app.current_tenant_id();  -- uuid de A
--   3. Como usuario B: select * from tenants;                    -- 0 filas
--   4. Como A: select app.next_counter(app.current_tenant_id(),'invoice',1000); -- 1000
--      repetir → 1001. Como B con el tenant de A → excepción 42501.
-- El test automatizado de aislamiento (tooling/tests/tenant-isolation) replica
-- esto en CI para TODA tabla nueva (CLAUDE.md regla 10).
-- ============================================================================
