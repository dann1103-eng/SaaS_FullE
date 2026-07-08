# DOCUMENTO 3 — Core Platform
### Diseño del núcleo de la plataforma
*Iteración 3. Consumo directo por Claude Code: este documento define contratos.*

---

## 0. Decisión de stack (ADR-001)

**Elegido:** Monorepo Turborepo · **Next.js (App Router) + TypeScript estricto** · **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions) · Tailwind 4 + shadcn/tokens propios · Vercel.

**Justificación:** (1) es el stack de FM/Kinetic — maximiza la cosecha de código donante (~70% de la lógica); (2) es el stack donde el fundador es más productivo; (3) RLS de Postgres es el mecanismo multi-tenant más barato de operar correcto; (4) un equipo de 1 persona + IA no debe operar microservicios. **Arquitectura: monolito modular** — módulos como paquetes del monorepo con fronteras estrictas (eventos/servicios, nunca imports cruzados de dominio), divisible a servicios después si un módulo lo exige (candidatos ya identificados: ingesta de pedidos, runner IA).

```
plataforma/
├── CLAUDE.md                  # constitución del repo para Claude Code (DOC12)
├── docs/                      # DOC1..DOC12 + adr/
├── apps/
│   └── web/                   # Next.js: app staff + portal (route groups (app)/(portal)/(auth))
├── packages/
│   ├── db/                    # tipos generados, cliente Supabase, helpers RLS
│   ├── core/                  # C1–C9: tenancy, eventos, jobs, notificaciones, permisos
│   ├── domain/                # lógica pura por módulo (cosechada): billing/, scheduling/, pricing/, payroll/, projects/, classify/
│   ├── ui/                    # design system (tokens + primitivos shadcn/base-ui de FM/Kinetic)
│   └── modules/               # m01-crm/ m02-catalog/ ... (server actions, componentes, tools IA, manifest)
├── supabase/
│   ├── migrations/            # SQL versionado (¡pipeline con CLI, no pegado manual!)
│   └── functions/             # edge functions (crons, webhooks pesados)
└── tooling/                   # eslint, tsconfig, scripts, seeds
```

---

## 1. C2 · Tenancy (el cimiento; se hace primero y se hace bien)

**Modelo:** una base de datos, aislamiento por fila.

```sql
tenants(id, slug unique, name, plan, status, settings jsonb, created_at)
units(id, tenant_id, slug, name, theme jsonb, settings jsonb)          -- marca/sede/CD
tenant_modules(tenant_id, module_key, status, activated_at, config jsonb, PK(tenant_id,module_key))
tenant_counters(tenant_id, key, value)                                  -- folios/correlativos por tenant
memberships(user_id, tenant_id, role_id, status)                        -- un user puede pertenecer a N tenants
```

**Reglas duras (invariantes de plataforma):**
1. **Toda** tabla de negocio lleva `tenant_id uuid not null references tenants` + índice compuesto que empieza por `tenant_id`.
2. RLS en toda tabla: plantilla única `tenant_isolation` (`tenant_id = (auth.jwt()->>'tenant_id')::uuid`) + políticas de rol encima. El `tenant_id` activo viaja en el JWT (custom claim vía hook de Supabase Auth) y se fija al seleccionar tenant.
3. `service_role` solo en: webhooks entrantes, runner de jobs, seeds. Siempre con `tenant_id` explícito en el código (nunca inferido del payload sin validar).
4. Folios y correlativos SIEMPRE por `tenant_counters` (función `next_counter(tenant, key)` con `UPDATE ... RETURNING`), nunca secuencias globales.
5. Configuración de negocio (IVA, moneda, TZ, umbrales, vocabularios) SIEMPRE en `tenants.settings`/`tenant_modules.config`, nunca constantes (los 6 donantes violan esto; la plataforma no).
6. **Test de aislamiento automatizado** en CI: por cada tabla nueva, verificación de que un JWT del tenant A no lee/escribe filas del tenant B.

**Self-service:** el registro crea `tenant` + `membership(owner)` + activa el bundle elegido en `tenant_modules`. El middleware y el sidebar leen `tenant_modules` (patrón `tabsForRol` de TAS elevado a `modulesForTenant`). Cada módulo declara un **manifest** (`module.manifest.ts`: key, dependsOn[], navItems, permissions, events producidos/consumidos, tools IA, settingsSchema) — el manifest es lo que el Core usa para activar, cobrar y componer la UI.

## 2. C1 · Identidad & Acceso

- **Auth:** Supabase Auth (email+password, magic link; OAuth después). Cookies HttpOnly SSR (`@supabase/ssr`), refresco en middleware (patrón FM/ADEC).
- **Usuarios ancla + extensiones** (P1): `users` (perfil de plataforma, 1:1 con auth.users) + `memberships` por tenant. ExternalIdentity = membership con `kind='external'` y vínculo a Accounts (`external_access(membership_id, account_id, capabilities jsonb)` — generaliza `client_users`/`family_users`).
- **RBAC:** `roles(tenant_id, key, name)` + `role_permissions(role_id, permission_key)`; permisos con convención `module.recurso.acción` (`m06.invoice.void`). Cada manifest registra sus permisos. Roles de fábrica por bundle; editables por tenant.
- **Defensa en profundidad** (P9): middleware (routing por rol/módulo) + guard en cada server action (`requirePermission()`) + RLS.
- **Extras heredados:** sesión única por dispositivo (Kinetic `SessionSentinel`), impersonación con `impersonation_logs` y banner, flags de onboarding (`must_change_password`, `must_confirm_data` — CAAA), anti-escalada de rol (Kinetic).

## 3. C4 · Eventos, Jobs & Automatización (el pegamento)

**DomainEvent (outbox transaccional):**
```sql
domain_events(id, tenant_id, event_key, entity_type, entity_id, payload jsonb,
              actor_id, occurred_at, processed_at, attempts)
```
- Se inserta **en la misma transacción** que el cambio de negocio (patrón outbox). El despachador (runner) entrega a los suscriptores: automatizaciones, notificaciones, tools IA, webhooks salientes, proyecciones de reporting.
- Suscripciones declarativas en cada manifest: `on('m07.payment.received', handler)`.
- Catálogo completo de eventos: DOC8.

**Job Queue (generalización de `ai_jobs` de FM):**
```sql
jobs(id, tenant_id, kind, payload jsonb, status, scheduled_for, attempts,
     last_error, cost_cents, created_at)   -- claim: FOR UPDATE SKIP LOCKED
job_events(job_id, at, type, detail jsonb) -- auditoría
```
Runner in-process disparado por (a) Vercel cron cada minuto, (b) trigger fire-and-forget tras encolar, (c) reintentos con backoff exponencial `min(60s, 2^attempts)`. Idempotencia por índices únicos parciales sobre `(tenant_id, kind, dedupe_key)`.

**Crons declarativos:** cada manifest registra crons (`daily-billing`, `project-notices`, `compliance-expiry`, `reprocess-pending`); un solo endpoint `/api/cron/tick` protegido por `CRON_SECRET` los despacha por tenant activo. Red de seguridad estilo ADEC: todo lo asíncrono es re-ejecutable e idempotente.

**Webhooks entrantes (raw-first, P5):**
```sql
inbound_events(id, tenant_id, source, topic, payload jsonb, headers jsonb,
               signature_valid bool, processed bool, error, entity_id, received_at)
```
Guardar crudo → responder 200 → procesar en `after()`/job → cron de reproceso. Verificadores HMAC por fuente (Woo, Meta, n1co) en `packages/core/webhooks`.

**Webhooks salientes:** `webhook_endpoints(tenant_id, url, secret, event_keys[])` + entregas con reintento (activa el diseño latente de CAAA).

## 4. C5 · Notificaciones

- `notifications(tenant_id, user_id, type, title, body, link, read_at)` — feed persistente, productores por evento.
- `notification_deliveries(tenant_id, channel, template_key, recipient, entity_ref, status, attempts, last_error, sent_at)` con **índice único TOTAL anti-duplicado** por `(tenant_id, channel, template_key, recipient, entity_ref)` y flujo reservar→enviar→marcar (endurecido sobre el parcial de ADEC por su ventana TOCTOU documentada — ver docs/adr/001).
- Transportes tras interfaz: `email` (Resend con dominio por tenant → fallback SMTP), `whatsapp` (M17), `sms` (futuro). Prioridad configurada, `TEST_MODE` por tenant con banner y redirect (TAS).
- Plantillas por tenant/Unit con theming (colores de marca — ADEC) y variables tipadas; preferencias por usuario.

## 5. C3 · Directorio & Dimensiones — según DOC5 §3.2 y §6 (parties, accounts, dimensions). El Core provee el CRUD de dimensiones y el componente de filtros por URL (INNO/ADEC) que todos los listados reutilizan.

## 6. C6 · Archivos — buckets por tenant (`{tenant}/module/...`), públicos (logos) vs privados (URLs firmadas), compresión de imágenes, ZIP con verificación de ACL, adjuntos polimórficos `attachments(tenant_id, entity_type, entity_id, file_path, kind)`.

## 7. C7 · Auditoría — `audit_log(tenant_id, actor_id, action, entity_type, entity_id, before jsonb, after jsonb, ip, user_agent, at)` con helper `withAudit()` en actions sensibles; sellos de inmutabilidad (facturas emitidas, planillas aprobadas) como triggers que rechazan UPDATE salvo campos permitidos.

## 8. C8 · Búsqueda — endpoint único que consulta módulos activos (detección numérica/texto de TAS); v1 con `ILIKE`+índices trigram, v2 con `tsvector`.

## 9. C9 · Plataforma IA (detalle de arquitectura en DOC9)

- `agents(tenant_id, audience, system_prompt, model, temperature, max_tokens, enabled_tools[], debounce_seconds, history_window)` — editable en runtime (FM).
- **Tool registry:** cada manifest exporta tools tipadas `{name, schema(zod), scope, fn(ctx)}`; el Core compone el catálogo según módulos activos y permisos del contexto (tenant/Account). Todo tool call se ejecuta con el mismo core de negocio que usan portal y staff (P11).
- `agent_runs` sobre `jobs` con `cost_cents` (fórmula de FM), cuotas por plan, prompt caching, sanitizadores por canal, handoff (`needs_attention`).
- `extraction_schemas(tenant_id, key, fields jsonb)` para captura conversacional (TAS) — un FormDefinition con vocabularios controlados.

## 10. APIs

- **Interna (staff/portal):** Server Actions con Zod + `requirePermission` (superficie primaria, patrón FM/INNO).
- **Integración/pública v1:** Route Handlers REST `/api/v1/{module}/...` autenticados por API keys por tenant (`api_keys(tenant_id, hash, scopes[])`) — lo que los donantes nunca tuvieron y un SaaS necesita. Contratos Zod compartidos con las actions (una sola validación).
- **Webhooks** in/out según §3. **Realtime:** canales Supabase con RLS para chat, presencia, tableros.

## 11. Localización

`packages/core/locale`: dinero (`numeric`, round6/round2, `formatCurrency`), fechas TZ-safe por tenant (P12, prohibido `toISOString()` para "hoy"), es-419 primero, catálogo fiscal por país como plugins (`fiscal/sv`: IVA 13, DTE, ISSS/AFP/ISR; interfaz para `fiscal/gt`, `fiscal/cr`...).

## 12. Seguridad (línea base heredada de lo mejor de los 6)

Firma HMAC timing-safe en todo webhook · service role quirúrgico · snapshots e índices únicos como invariantes · sin secretos en repo (`.env.example` completo — antideuda FM) · rate limiting en endpoints públicos (carencia ADEC/TAS) · encriptación de campos sensibles vía Vault · sin contraseñas propias jamás (sustituye el esquema TAS) · headers de seguridad y Permissions-Policy (FM).
