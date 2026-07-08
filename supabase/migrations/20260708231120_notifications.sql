-- ============================================================================
-- MIGRACIÓN 0004 — C5: Notificaciones (Sesión 4 · DOC3 §4)
-- ============================================================================
-- Contenido: feed in-app persistente (notifications) + entregas
-- transaccionales multicanal (notification_deliveries, ADR-001) + watchdog
-- de jobs huérfanos en claim_jobs (gap detectado en el donante FM).
--
-- Cosecha: ADEC (reintentos+idempotencia; su TOCTOU se corrige con el índice
-- TOTAL y el flujo reservar→enviar→marcar del ADR-001) y TAS (multi-transporte
-- con TEST_MODE; su falta de auditoría se corrige con esta tabla).
--
-- Patrón de permisos (lección 0002/0003, ahora determinista desde el inicio):
-- REVOKE ALL a authenticated/anon tras crear cada tabla y luego grants
-- exactos — mismo resultado en hosted (default privileges) y stack local.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NOTIFICATIONS (feed in-app — DOC5 §3.9: tabla persistente, productores
--    por evento; resuelve el "sistema con 1 productor" de CAAA)
-- ----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  type       text not null check (type ~ '^[a-z0-9_.]{2,60}$'),
  title      text not null check (length(title) between 1 and 200),
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.notifications is
  'Feed in-app por usuario. Escriben los productores por evento (runner); el usuario solo lee y marca leído.';

create index idx_notifications_user on public.notifications (tenant_id, user_id, created_at desc);
create index idx_notifications_unread on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid() and app.is_member(tenant_id));
-- Marcar leído: la política limita a las propias; el grant de COLUMNA limita
-- qué se puede cambiar (solo read_at).
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notifications from authenticated, anon;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;

-- ----------------------------------------------------------------------------
-- 2. NOTIFICATION_DELIVERIES (entregas transaccionales — DOC3 §4 + ADR-001)
--    Flujo: el productor RESERVA la fila (unique total = idempotencia dura);
--    el runner del tick envía y transiciona pending → sent | failed.
-- ----------------------------------------------------------------------------
create table public.notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  channel         text not null check (channel in ('email','whatsapp','sms')),
  template_key    text not null check (template_key ~ '^[a-z0-9_.]{2,80}$'),
  recipient       text not null check (length(recipient) between 3 and 320),
  -- Ancla de idempotencia: 'entidad:uuid' (+ ':período' si es repetible)
  entity_ref      text not null check (length(entity_ref) between 2 and 160),
  variables       jsonb not null default '{}'::jsonb,
  status          text not null default 'pending'
                  check (status in ('pending','sent','failed')),
  attempts        int not null default 0 check (attempts >= 0),
  max_attempts    int not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  provider_id     text,          -- id del proveedor (p. ej. Resend) — auditoría
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.notification_deliveries is
  'Entregas multicanal con idempotencia TOTAL (ADR-001): una clave lógica = una entrega, para siempre. Reintentos reutilizan la fila (backoff en next_attempt_at).';

create trigger trg_notification_deliveries_updated_at
  before update on public.notification_deliveries
  for each row execute function app.set_updated_at();

-- ADR-001: único TOTAL (sin where) — cierra la ventana TOCTOU del donante.
create unique index uq_deliveries_dedupe on public.notification_deliveries
  (tenant_id, channel, template_key, recipient, entity_ref);

create index idx_deliveries_pending on public.notification_deliveries (next_attempt_at)
  where status = 'pending';
create index idx_deliveries_tenant on public.notification_deliveries (tenant_id, created_at desc);

alter table public.notification_deliveries enable row level security;
create policy deliveries_select on public.notification_deliveries
  for select to authenticated using (app.is_member(tenant_id));
create policy deliveries_insert on public.notification_deliveries
  for insert to authenticated with check (tenant_id = app.current_tenant_id());
-- Transiciones de estado: solo el runner (service_role).

revoke all on public.notification_deliveries from authenticated, anon;
grant select, insert on public.notification_deliveries to authenticated;
grant select, insert, update, delete on public.notification_deliveries to service_role;

-- ----------------------------------------------------------------------------
-- 3. WATCHDOG DE JOBS HUÉRFANOS (contraste con el donante FM, Sesión 4)
--    FM deja jobs en 'processing' para siempre si el worker muere; aquí el
--    claim rescata los 'running' estancados >10 min antes de reclamar nuevos.
--    max_attempts sigue acotando el total de ejecuciones.
-- ----------------------------------------------------------------------------
create or replace function public.claim_jobs(p_limit int default 10)
returns setof public.jobs
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'claim_jobs: solo el runner (service_role)' using errcode = '42501';
  end if;

  update public.jobs
     set status = 'pending',
         last_error = 'watchdog: reclamado tras >10 min en running',
         updated_at = now()
   where status = 'running'
     and updated_at < now() - interval '10 minutes';

  return query
  with due as (
    select j.id
    from public.jobs j
    where j.status = 'pending' and j.scheduled_for <= now()
    order by j.scheduled_for
    limit greatest(p_limit, 0)
    for update skip locked
  )
  update public.jobs j
     set status = 'running', attempts = j.attempts + 1, updated_at = now()
    from due
   where j.id = due.id
  returning j.*;
end $$;
