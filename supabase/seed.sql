-- ============================================================================
-- SEEDS DE DESARROLLO (Sesión 1 · DOC12 §5)
-- ============================================================================
-- SOLO para el stack local / CI: se aplica con `supabase db reset` o el primer
-- `supabase start`. NUNCA se ejecuta contra el proyecto remoto (db push no
-- corre seeds). Crea dos usuarios y dos tenants de demostración para navegar
-- el aislamiento en desarrollo:
--   · ana.demo@example.com   / password123  → tenant demo-a (owner)
--   · bruno.demo@example.com / password123  → tenant demo-b (owner)
-- El test automatizado de aislamiento NO depende de estos seeds (crea sus
-- propios usuarios efímeros); esto es material de demo humana.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Usuarios de Auth (patrón estándar de seed local de Supabase)
--    El trigger on_auth_user_created crea el perfil en public.users.
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'ana.demo@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ana Demo"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'bruno.demo@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Bruno Demo"}'::jsonb,
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"ana.demo@example.com","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    gen_random_uuid(),
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"bruno.demo@example.com","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Tenants demo con rol owner, membresía y módulo core
--    (equivale a app.provision_tenant, que aquí no aplica: auth.uid() es null
--    en contexto de seed)
-- ----------------------------------------------------------------------------
insert into public.tenants (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demo-a', 'Demo A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'demo-b', 'Demo B')
on conflict (id) do nothing;

insert into public.roles (id, tenant_id, key, name, is_system) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'Propietario', true),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner', 'Propietario', true)
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_key) values
  ('aaaaaaaa-1111-1111-1111-111111111111', '*'),
  ('bbbbbbbb-2222-2222-2222-222222222222', '*')
on conflict do nothing;

insert into public.memberships (tenant_id, user_id, role_id, kind, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-111111111111', 'staff', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-2222-2222-2222-222222222222', 'staff', 'active')
on conflict (tenant_id, user_id) do nothing;

insert into public.tenant_modules (tenant_id, module_key) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'core'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'core')
on conflict (tenant_id, module_key) do nothing;

update public.users set active_tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  where id = '11111111-1111-1111-1111-111111111111';
update public.users set active_tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  where id = '22222222-2222-2222-2222-222222222222';

-- Unidad y contador de ejemplo (folio de factura arrancando en 1000)
insert into public.units (tenant_id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'central', 'Sede Central')
on conflict (tenant_id, slug) do nothing;

insert into public.tenant_counters (tenant_id, key, value) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'invoice', 999)
on conflict (tenant_id, key) do nothing;
