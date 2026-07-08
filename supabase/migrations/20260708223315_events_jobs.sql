-- ============================================================================
-- MIGRACIÓN 0002 — C4: Eventos, Jobs & Automatización (Sesión 3 · DOC3 §3)
-- ============================================================================
-- Contenido: outbox domain_events (bus interno, catálogo DOC8), cola jobs con
-- claim atómico (FOR UPDATE SKIP LOCKED) e idempotencia por índice único
-- parcial (CLAUDE.md regla 11), auditoría job_events, RPC public.claim_jobs
-- (solo service_role) y helper app.emit_domain_event para RPCs/triggers.
-- Webhooks entrantes (inbound_events) llegan con su primer consumidor.
--
-- Invariantes:
--   · domain_events y job_events son APPEND-ONLY por API (sin políticas de
--     update/delete para authenticated); solo el runner (service_role) marca
--     processed_at / transiciones de estado.
--   · Emisión transaccional (outbox): dentro de RPCs y triggers usar
--     app.emit_domain_event en la MISMA transacción del cambio de negocio.
--     Desde server actions, packages/core inserta en el outbox tras el
--     cambio; el despachador tolera re-entrega (consumidores idempotentes).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DOMAIN_EVENTS (outbox transaccional — DOC3 §3, anatomía DOC8 §1)
-- ----------------------------------------------------------------------------
create table public.domain_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  -- Convención cerrada DOC8: modulo.entidad.accion_pasado (agregar clave nueva ⇒ ADR)
  event_key    text not null
               check (event_key ~ '^(core|m[0-9]{2})\.[a-z0-9_]+\.[a-z0-9_]+$'),
  entity_type  text not null check (length(entity_type) between 2 and 60),
  entity_id    uuid,
  payload      jsonb not null default '{}'::jsonb,  -- autosuficiente (DOC8 §1)
  actor_kind   text not null default 'system'
               check (actor_kind in ('user','agent','system','external')),
  actor_id     uuid,
  version      int not null default 1,
  occurred_at  timestamptz not null default now(),
  processed_at timestamptz,
  attempts     int not null default 0,
  last_error   text
);
comment on table public.domain_events is
  'Outbox de eventos de negocio (DOC8). Se inserta junto al cambio; el runner despacha a los suscriptores declarados en los manifests.';

create index idx_domain_events_tenant on public.domain_events (tenant_id, occurred_at desc);
create index idx_domain_events_pending on public.domain_events (occurred_at)
  where processed_at is null;

alter table public.domain_events enable row level security;
create policy domain_events_select on public.domain_events
  for select to authenticated using (app.is_member(tenant_id));
create policy domain_events_insert on public.domain_events
  for insert to authenticated with check (tenant_id = app.current_tenant_id());
-- Sin update/delete por API: solo el runner (service_role, bypass RLS).

-- ----------------------------------------------------------------------------
-- 2. JOBS (cola en Postgres, generalización de ai_jobs de FM — DOC3 §3)
-- ----------------------------------------------------------------------------
create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  kind          text not null check (kind ~ '^[a-z0-9_.-]{2,60}$'),
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'pending'
                check (status in ('pending','running','succeeded','failed','cancelled')),
  scheduled_for timestamptz not null default now(),
  attempts      int not null default 0 check (attempts >= 0),
  max_attempts  int not null default 5 check (max_attempts between 1 and 20),
  dedupe_key    text check (dedupe_key is null or length(dedupe_key) between 2 and 120),
  last_error    text,
  cost_cents    int,                      -- metering IA (C9, fórmula FM)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.jobs is
  'Cola de trabajos por tenant. Claim atómico vía public.claim_jobs (FOR UPDATE SKIP LOCKED); reintentos con backoff min(60s, 2^attempts).';

create trigger trg_jobs_updated_at
  before update on public.jobs
  for each row execute function app.set_updated_at();

-- Idempotencia (CLAUDE.md regla 11): un efecto lógico = un job, para siempre.
-- Los kinds periódicos incluyen el período en la clave (p. ej. 'billing:2026-07').
create unique index uq_jobs_dedupe on public.jobs (tenant_id, kind, dedupe_key)
  where dedupe_key is not null;

create index idx_jobs_tenant on public.jobs (tenant_id, created_at desc);
create index idx_jobs_claim on public.jobs (scheduled_for) where status = 'pending';

alter table public.jobs enable row level security;
create policy jobs_select on public.jobs
  for select to authenticated using (app.is_member(tenant_id));
create policy jobs_insert on public.jobs
  for insert to authenticated with check (tenant_id = app.current_tenant_id());
-- Transiciones de estado: solo el runner (service_role).

-- ----------------------------------------------------------------------------
-- 3. JOB_EVENTS (auditoría de la cola — DOC3 §3)
-- ----------------------------------------------------------------------------
create table public.job_events (
  id      uuid primary key default gen_random_uuid(),
  job_id  uuid not null references public.jobs(id) on delete cascade,
  at      timestamptz not null default now(),
  type    text not null
          check (type in ('enqueued','claimed','succeeded','failed','rescheduled','cancelled')),
  detail  jsonb not null default '{}'::jsonb
);
comment on table public.job_events is
  'Bitácora append-only de cada job (quién/cuándo/qué pasó). Escribe solo el runner.';

create index idx_job_events_job on public.job_events (job_id, at);

alter table public.job_events enable row level security;
create policy job_events_select on public.job_events
  for select to authenticated
  using (exists (select 1 from public.jobs j
                 where j.id = job_id and app.is_member(j.tenant_id)));
-- Sin insert/update/delete por API: escribe el runner (service_role).

-- ----------------------------------------------------------------------------
-- 4. GRANTS BASE (paridad hosted/local — lección de la migración 0001 §11.b)
--    authenticated: leer lo propio y ENCOLAR/EMITIR; nunca mutar estados.
-- ----------------------------------------------------------------------------
grant select, insert on public.domain_events, public.jobs to authenticated;
grant select on public.job_events to authenticated;
grant select, insert, update, delete
  on public.domain_events, public.jobs, public.job_events
  to service_role;

-- ----------------------------------------------------------------------------
-- 5. app.emit_domain_event — emisión transaccional para RPCs y triggers
--    (patrón outbox verdadero: misma transacción que el cambio de negocio)
-- ----------------------------------------------------------------------------
create or replace function app.emit_domain_event(
  p_tenant      uuid,
  p_event_key   text,
  p_entity_type text,
  p_entity_id   uuid,
  p_payload     jsonb default '{}'::jsonb,
  p_actor_kind  text default 'system',
  p_actor_id    uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role'
     and not app.is_member(p_tenant) then
    raise exception 'emit_domain_event: caller is not a member of tenant %', p_tenant
      using errcode = '42501';
  end if;

  insert into public.domain_events
    (tenant_id, event_key, entity_type, entity_id, payload, actor_kind, actor_id)
  values
    (p_tenant, p_event_key, p_entity_type, p_entity_id,
     coalesce(p_payload, '{}'::jsonb), p_actor_kind, coalesce(p_actor_id, auth.uid()))
  returning id into v_id;

  return v_id;
end $$;
grant execute on function app.emit_domain_event(uuid, text, text, uuid, jsonb, text, uuid)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. public.claim_jobs — claim atómico para el runner (DOC3 §3)
--    En public para ser invocable por PostgREST, pero SOLO con service_role.
-- ----------------------------------------------------------------------------
create or replace function public.claim_jobs(p_limit int default 10)
returns setof public.jobs
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'claim_jobs: solo el runner (service_role)' using errcode = '42501';
  end if;

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
revoke execute on function public.claim_jobs(int) from public, anon, authenticated;
grant execute on function public.claim_jobs(int) to service_role;
