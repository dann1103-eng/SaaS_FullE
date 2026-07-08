# ROADMAP — Fase 0 + Fase 1 (plan de sesiones)

Checklist de las 17 sesiones del plan de acción ([docs/DOC12](docs/DOC12-Plan-Accion-Claude-Code.md) §5).
Se actualiza **al cierre de cada sesión** (DOC12 §4.6). El roadmap general de
producto por fases vive en [docs/DOC10](docs/DOC10-Roadmap.md).

| Estado | # | Sesión (≈1 branch/PR c/u) | Entrada principal |
|---|---|---|---|
| ✅ 2026-07-08 | 0 | Scaffold monorepo + CI + CLAUDE.md | DOC3 §0, DOC12 §3 |
| ✅ 2026-07-08 | 1 | Migración 0001 tenancy + RLS template + test de aislamiento + seeds | DOC3 §1 |
| ✅ 2026-07-08 | 2 | C1 Auth (Supabase Auth + memberships + JWT claims + middleware + requirePermission) | DOC3 §2 |
| ⬜ | 3 | C4 outbox domain_events + jobs (cosecha runner FM) + cron tick | DOC3 §3, donante FM |
| ⬜ | 4 | C5 notificaciones (deliveries idempotentes + feed + transporte email) | DOC3 §4, donantes ADEC/TAS |
| ⬜ | 5 | C7 audit + C6 storage helpers + C3 dimensiones + ui-kit base (cosecha tokens FM/Kinetic) | DOC3, DOC5 §6 |
| ⬜ | 6 | Registro self-service + tenant_modules + manifest loader + navegación dinámica | DOC3 §1, DOC7 §4 |
| ⬜ | 7 | **M01 CRM** (spec→schema→domain→UI; jerarquía+dedupe de TAS) | DOC6 M01, DOC4 |
| ⬜ | 8 | **M02 Catálogo** (ítems+variantes+precios simples+FeeRules; import CSV de ADEC) | DOC6 M02 |
| ⬜ | 9 | **M06 Facturación** (cosecha invoice-create FM + PDF) | DOC6 M06 |
| ⬜ | 10 | **M07 Pagos** (interfaz PaymentProvider + adapter n1co + webhook raw + matcher) | DOC6 M07, donante FM |
| ⬜ | 11 | **M08 Recurrencia** (ciclos+mora+gracia+suspensión; cron diario) | DOC6 M08, donantes FM/Kinetic |
| ⬜ | 12 | **M05 Agenda** (motor Kinetic: solapamientos, cierres, drag&drop, capacidad) | DOC6 M05, donante Kinetic |
| ⬜ | 13 | **M19 Portal v1** (shell + facturas + pagar + agenda lectura + solicitudes) | DOC6 M19 |
| ⬜ | 14 | **M25 Reportería básica** (KPIs + exportadores de INNO/Kinetic) | DOC6 M25 |
| ⬜ | 15 | **C9 + agente de lectura en portal** (runtime+registry+metering; tools M01/M06/M08) | DOC9 v1 |
| ⬜ | 16 | Hardening MVP: rate limiting, e2e del flujo dinero, seeds de demo, onboarding UX | DOC10 criterio de salida F1 |

Después de la sesión 16: design partners reales → feedback → Fase 2 (DOC10).

## Notas de la Sesión 0 (2026-07-08)

- **Migración staged:** `0001_tenancy_foundation.sql` queda en la raíz; en la
  Sesión 1 se mueve a `supabase/migrations/` renombrada con timestamp del CLI
  (ver pasos manuales en el encabezado del propio archivo: hook JWT en el
  Dashboard, refresh de sesión, seeds en `supabase/seed.sql`).
- **Scope interino:** los paquetes usan `@plataforma/*` hasta que se decida
  [NOMBRE] (prerrequisito DOC12 §1); al decidirlo, renombrar packages y el
  título de CLAUDE.md.
- **Repos donantes:** las rutas locales siguen pendientes en CLAUDE.md
  (prerrequisito DOC12 §1: acceso de lectura a los 6 repos).
- **Check de imports entre módulos (regla 3 de CLAUDE.md):** la verificación en
  CI se implementa cuando exista el primer módulo (Sesión 7).
- **Versiones:** create-next-app fijó TypeScript `^5` y ESLint `^9`; todos los
  packages usan esas mismas versiones (workspace de versión única). Stack: Next
  16.2 · Tailwind 4 · turbo 2.10 · vitest 4 · pnpm 10.
- **Ojo (aviso del template):** `apps/web/AGENTS.md` advierte que esta versión
  de Next.js tiene cambios de API respecto a versiones anteriores — leer
  `node_modules/next/dist/docs/` antes de escribir código de la app (Sesión 2+).

## Notas de la Sesión 1 (2026-07-08)

- **Migración aplicada al proyecto real** `ehllkqxrgkexlhrswotk` (us-east-1)
  vía `supabase db push --db-url` (session pooler). Historial CLI:
  `20260708062040_tenancy_foundation.sql` (incluye grants explícitos §11.b,
  hallazgo del CI).
- **Test de aislamiento 9/9 verde contra el proyecto remoto**
  (`tooling/tests/tenant-isolation`): simula el contexto PostgREST con
  `set local role` + `request.jwt.claims` dentro de una transacción con
  rollback — cero residuo verificado. Toda migración futura añade aquí sus
  asserts (CLAUDE.md regla 10). En CI corre el job `tenant-isolation` con el
  stack local (se dispara en PRs y pushes a main).
- **⚠️ PENDIENTE MANUAL (bloquea Sesión 2):** habilitar el hook JWT en el
  Dashboard → Authentication → Hooks → "Custom Access Token" →
  `public.custom_access_token_hook`. Sin esto el claim `tenant_id` no viaja
  y las políticas devuelven vacío. (En local/CI ya está vía `config.toml`.)
- **Región (resuelto):** el primer proyecto se creó en `ca-central-1`; se
  recreó en `us-east-1` conforme a DOC12 §1 (colocación con las funciones de
  Vercel + menor latencia desde El Salvador). El proyecto de `ca-central-1`
  (`mvdfqibvhnoslgpekhyv`) queda pendiente de **borrar** por Daniel.
- **Credenciales:** `.env` local (gitignoreado) completo: URL, anon key,
  service_role key y `SUPABASE_DB_URL` del proyecto definitivo.
- **Seeds** (`supabase/seed.sql`): solo stack local/CI (2 tenants demo);
  `db push` no los ejecuta contra remoto, por diseño.

## Notas de la Sesión 2 (2026-07-08)

- **C1 Auth operativo y verificado e2e en navegador real** contra el proyecto
  definitivo: proxy (Next 16 renombró middleware→`proxy.ts`) con refresh de
  sesión y redirects optimistas · login con server action + Zod ·
  `requireAuth` (DAL cacheada) · switcher de tenant (update de
  `active_tenant_id` + `refreshSession` → claim nuevo) · logout ·
  `requirePermission()`/`fetchGrants` en `packages/core` con matcher TDD en
  **paridad exacta** con `app.has_permission` SQL (si cambia la semántica,
  cambiar SQL primero y tests después).
- **`packages/db`:** clientes browser/server(adaptador de cookies)/admin +
  env tipado con Zod. **`types.ts` está escrito a mano** contra el esquema
  real: `supabase gen types --db-url` exige Docker (no hay). PENDIENTE:
  con un Personal Access Token de la cuenta (Dashboard → Account → Access
  Tokens) se regenera con `--project-id` sin Docker — pedir a Daniel y
  automatizar por migración.
- **Env de la app:** Next lee `.env` desde `apps/web/` → las claves viven en
  `apps/web/.env.local` (gitignoreado); el `.env` de la raíz sirve para
  scripts/tooling.
- **Diferido a propósito** (extras DOC3 §2, no en el alcance DOC12 de S2):
  magic link/OAuth, sesión única por dispositivo (SessionSentinel),
  impersonación auditada, flags de onboarding. El registro self-service es
  la Sesión 6.
