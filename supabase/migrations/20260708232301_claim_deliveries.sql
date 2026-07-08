-- ============================================================================
-- MIGRACIÓN 0005 — claim_deliveries: reloj de BD como fuente única (Sesión 4)
-- ============================================================================
-- Hallazgo de la verificación real: la fase de deliveries del tick filtraba
-- next_attempt_at contra el reloj JS del app server; una fila insertada en el
-- mismo tick (default now() de la BD) quedaba "en el futuro" por milisegundos
-- de desfase entre relojes y no se enviaba hasta el siguiente tick.
--
-- Corrección de raíz: la elegibilidad se decide SIEMPRE con now() de la BD,
-- vía RPC exclusiva del runner — simétrica a claim_jobs.
-- ============================================================================

create or replace function public.claim_deliveries(p_limit int default 25)
returns setof public.notification_deliveries
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'claim_deliveries: solo el runner (service_role)' using errcode = '42501';
  end if;

  -- Un runner por tick (cron); sin transición de estado en el claim — el
  -- envío marca sent/failed y los reintentos reprograman next_attempt_at.
  return query
  select d.*
  from public.notification_deliveries d
  where d.status = 'pending' and d.next_attempt_at <= now()
  order by d.next_attempt_at
  limit greatest(p_limit, 0);
end $$;
revoke execute on function public.claim_deliveries(int) from public, anon, authenticated;
grant execute on function public.claim_deliveries(int) to service_role;
