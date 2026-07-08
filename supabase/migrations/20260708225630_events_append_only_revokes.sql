-- ============================================================================
-- MIGRACIÓN 0003 — Append-only estricto por API para C4 (Sesión 3)
-- ============================================================================
-- La 0002 concedió solo select/insert a authenticated, pero en Supabase
-- hosted los DEFAULT PRIVILEGES añaden update/delete por debajo: el mismo
-- update devolvía "0 filas" (RLS sin política) en hosted y "permission
-- denied" (42501) en el stack local/CI. Lo detectó el job tenant-isolation.
--
-- Decisión: el intento de mutar el outbox/bitácora/estados de la cola desde
-- la API debe ser un ERROR explícito (42501), no un no-op silencioso, y debe
-- comportarse IGUAL en todo entorno. Se revoca lo que los defaults regalan.
-- Las transiciones de estado son exclusivas del runner (service_role).
-- ============================================================================

revoke update, delete on public.domain_events from authenticated, anon;
revoke update, delete on public.jobs from authenticated, anon;
revoke insert, update, delete on public.job_events from authenticated, anon;

-- anon no tiene ningún rol operativo sobre C4 (los defaults de hosted le
-- conceden de todo): fuera también la lectura y el insert.
revoke select, insert on public.domain_events from anon;
revoke select, insert on public.jobs from anon;
revoke select on public.job_events from anon;
