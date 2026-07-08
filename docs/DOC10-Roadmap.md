# DOCUMENTO 10 — Roadmap de Construcción
### Del monorepo vacío a la plataforma
*Iteración 3. Ajuste clave acordado: los clientes actuales conservan sus sistemas → **greenfield puro para clientes nuevos**, sin migración de datos ni compatibilidad. Los sistemas actuales son donantes de código (DOC4).*

---

## 0. Estrategia

1. **Un bundle primero, no 26 módulos:** el MVP es el bundle **Servicios Recurrentes** (heredero directo de FM/Kinetic: máximo código donante, máximo mercado — agencias, clínicas, academias, estudios, consultoras).
2. **Core impecable antes que features:** tenancy+RLS+eventos+jobs se hacen una vez y bien; todo lo demás se apoya ahí.
3. **Cosechar, no reescribir:** primero lógica pura con sus tests (Kinetic `lib/domain`, INNO `pricing`, ADEC `classify-core`, TAS `calcEstado`), luego esquema con tenant_id, luego UI sobre el design system.
4. **Design partner por fase:** cada fase se valida con 1–2 clientes nuevos reales del vertical correspondiente (tú mismo puedes venderlos — ya conoces los seis mercados).
5. **Regla anti-sobre-generalización:** lo que existe 1 vez en los donantes se porta tal cual y se generaliza cuando aparezca el segundo caso de uso pagado.

## Fase 0 — Fundaciones (el "Sprint 0")
**Objetivo:** monorepo operable por Claude Code con las reglas de juego incrustadas.
- Scaffold Turborepo (estructura DOC3 §0) + CI (typecheck, lint, tests, **test de aislamiento RLS**).
- `CLAUDE.md` + `docs/` con los 12 documentos + ADRs iniciales (stack, tenancy, eventos, dinero/TZ).
- Migración 0001: `tenants/units/memberships/tenant_modules/tenant_counters/roles/permissions` + plantilla RLS + seeds de desarrollo.
- `packages/core`: outbox `domain_events` + `jobs` (claim atómico, cosechado de FM) + `inbound_events` raw-first + `notifications`/`notification_deliveries` + `audit_log` + helpers (`requirePermission`, `withAudit`, `next_counter`, locale/dinero/TZ).
- `packages/ui`: tokens + primitivos (cosecha FM/Kinetic) + filtros URL (INNO/ADEC) + badges/EmptyState.
- Registro self-service mínimo: crear tenant → elegir bundle → entrar.
**Criterio de salida:** dos tenants de prueba no pueden verse entre sí (test automatizado); un evento de dominio recorre outbox→job→notificación.

## Fase 1 — MVP: Bundle "Servicios Recurrentes"
**Módulos:** M01 CRM · M02 Catálogo (sin listas N; precios simples + FeeRules) · M05 Agenda (motor Kinetic; 3D de CAAA en fase 2) · M06 Facturación (fiscal SV, PDF) · M07 Pagos (interfaz PaymentProvider + n1co) · M08 Recurrencia (ciclos, mora, gracia, suspensión) · M25 Reportería básica (KPIs + export) · M19 Portal v1 (ver+pagar+solicitar) · C9 base + agente de lectura en portal (DOC9 v1).
**Donantes:** FM (ciclos/pagos/facturas/portal), Kinetic (agenda/domain), INNO (snapshot+folios), ADEC (notificaciones).
**Criterio de salida (GA privada):** un tenant nuevo se registra solo, configura catálogo y clientes, agenda, factura, cobra online con conciliación automática y su cliente final usa el portal — sin tocar la base de datos a mano. 2 design partners activos.

## Fase 2 — V1: Profundidad económica + operación con cliente
- M09 Ledger/Prepago (CAAA) — abre gimnasios/academias/clínicas por paquete.
- M10 Pipelines + M11 Revisión (aprobación genérica; proofing después) + M14 Tiempo + M15 Tareas.
- M17 WhatsApp (WABA por tenant / Embedded Signup) + M18 tools de escritura económicas (links, extras, renovaciones) + handoff.
- M05 ampliada: conflictos 3D + auto-agendamiento del cliente final + publicación semanal (CAAA).
- Reportería con Dimensiones (C3 completo).
- **Vertical packs V1 (Clínicas) y V2 (Agencias)** como plantillas instalables (los dos con más donante).
**Criterio:** 10+ tenants de pago; el bot cobra dinero real; churn de activación <20%.

## Fase 3 — V2: Los verticales operativos
- M04 Field Service + Extraction Service (boleta por voz) + encuesta post-servicio → **pack V3**.
- M03 Pedidos (armador INNO + ingesta ADEC con adaptador WooCommerce) + M02 listas de precios N → **packs V5/V6**.
- M13 Subcontratistas + M12 Compliance.
- M16 Chat & Llamadas (LiveKit) + M20 Nómina + M21 Egresos.
- M11 Proofing visual (pines) para V2.
- API pública v1 (keys por tenant) + webhooks salientes.
**Criterio:** 3 verticales con ≥3 tenants cada uno; NPS>40; API consumida por al menos 1 integración externa.

## Fase 4 — V3: Cierre del catálogo + escala
- M22 Activos & Mantenimiento · M23 Rutas · M24 Flota (FleetProvider) · M26 LMS → **pack V4 Aviación** completo.
- IA v3 (RAG por tenant, visión compliance, analista narrativo, agentes proactivos — DOC9).
- Localización fiscal #2 (GT o CR como plugin — valida la interfaz `fiscal/*`).
- Marketplace de plantillas (pipelines, formularios, checklists) — la comunidad como foso.
- Escala: read replicas si hace falta, particionado por tenant_id en tablas calientes (domain_events, jobs, messages), extracción a servicio del runner IA y/o ingesta si el volumen lo exige (fronteras ya limpias por diseño).

## Migración / compatibilidad (reformulado)

- **Clientes actuales: cero acción.** Sus sistemas siguen intactos, con su mantenimiento normal como servicio tuyo.
- **Oferta opcional futura (V2+):** "upgrade a plataforma" como proyecto pagado por cliente que lo pida — importadores de datos (el patrón del importador Excel de INNO, generalizado) y equivalencia funcional por vertical pack. Nunca forzado, nunca en el camino crítico del roadmap.
- **Compatibilidad interna:** los donantes no se tocan; si un fix de plataforma aplica a un donante, se porta a mano (flujo unidireccional donante→plataforma).

## Deuda técnica preventiva (no repetir la de los donantes)

| Deuda observada en donantes | Regla de plataforma |
|---|---|
| Migraciones pegadas a mano en SQL Editor (TAS/INNO/Kinetic) | Supabase CLI + migraciones en CI desde el día 1 |
| `.env` incompleto/no versionado (FM) | env tipado (zod) + `.env.example` generado |
| Contraseñas propias/texto plano (TAS) | jamás auth propia |
| Constantes de negocio hardcodeadas (6/6) | settings por tenant obligatorio (lint rule para literales de dinero/IVA) |
| Imports cruzados entre módulos (CAAA/FM) | CI bloquea imports entre `packages/modules/*`; solo eventos/servicios |
| Enum drift entre tablas gemelas (CAAA) | estados en configuración, única fuente |
| Spec de API desactualizado (TAS Orval) | contratos Zod únicos compartidos action/API |
| Sin rate limiting en endpoints públicos (ADEC/TAS) | middleware de rate limit en /api públicos |

## Riesgos del roadmap y disparadores de re-plan

- **Scope creep del MVP** → la lista de Fase 1 es cerrada; todo lo demás es backlog con fecha de revisión.
- **WhatsApp multi-tenant se atasca en Meta** → el agente vive en portal web (v1) sin bloquear; email como canal de dunning.
- **n1co no soporta el modelo plataforma** → PaymentProvider ya abstrae; activar Stripe/Wompi para tenants fuera de SV.
- **Un vertical pide profundidad antes de tiempo** → se adelanta SU pack, no se rompe el orden del Core.
