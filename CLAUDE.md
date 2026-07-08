# Plataforma ____ — Constitución del repositorio

## Qué es
SaaS modular multi-tenant self-service para PyMEs LatAm. La especificación completa
vive en docs/DOC1..DOC12. Ante cualquier duda de diseño: el documento manda.
- Modelo de dominio y entidades: docs/DOC5
- Catálogo y alcance de cada módulo: docs/DOC6
- Dependencias entre módulos: docs/DOC7
- Eventos (nombres y cadenas): docs/DOC8
- Core (tenancy, auth, jobs, contratos): docs/DOC3
- Qué cosechar de los donantes: docs/DOC4

## Reglas duras (violarlas = PR rechazado)
1. TODA tabla de negocio: `tenant_id uuid not null` + RLS con la plantilla
   tenant_isolation + índice que empieza por tenant_id. Sin excepciones.
2. Folios/correlativos: SOLO via next_counter(tenant, key). Prohibidas secuencias globales.
3. Ningún import entre packages/modules/*. Comunicación entre módulos: DomainEvents
   (docs/DOC8) o servicios de packages/core. CI lo verifica.
4. Todo evento externo entrante se persiste crudo en inbound_events ANTES de procesarse.
5. Documentos transaccionales (facturas, pedidos, planillas): snapshot inmutable de líneas
   y términos. Emitidos/sellados no se editan; se anulan con contrapartida.
6. Dinero: numeric en BD, round6 en tuberías, round2 en agregados, formatCurrency del core.
   Fechas "hoy": SIEMPRE con la TZ del tenant (core/locale). Prohibido new Date().toISOString()
   para fechas de negocio.
7. Config de negocio (IVA, umbrales, textos, vocabularios): en tenant settings/config,
   nunca constantes en código.
8. Server Actions: Zod + requirePermission() + withAudit() en acciones sensibles.
9. service_role solo en webhooks/jobs/seeds, con tenant_id explícito validado.
10. Toda migración nueva de tabla incluye su política RLS y actualiza el test de
    aislamiento (tooling/tests/tenant-isolation).
11. Idempotencia: efectos con posible re-entrega llevan índice único parcial (dedupe_key).
12. Nada de auth propia, nada de contraseñas en texto plano, secretos solo en env tipado.

## Convenciones
- Eventos: `mXX.entidad.accion_pasado` — el catálogo cerrado está en DOC8; agregar uno nuevo
  requiere ADR corto en docs/adr/.
- Módulos: packages/modules/mXX-nombre con module.manifest.ts (key, dependsOn, permissions,
  produces, consumes, navItems, tools, settingsSchema).
- Permisos: `mXX.recurso.accion`.
- Migraciones: supabase/migrations vía CLI, numeradas, con comentario de propósito.
- UI: componentes de packages/ui; nada de estilos ad-hoc que dupliquen tokens.
- Tests: lógica de packages/domain con cobertura obligatoria (es código cosechado con
  tests en origen — portarlos).

## Repos donantes (solo lectura, para cosechar)
- FM CRM:      C:\Users\Daniel\Desktop\FM CRM
- Kinetic:     C:\Users\Daniel\Desktop\Kinetic Web
- TAS:         C:\Users\Daniel\Desktop\TAS platform
- CAAA:        C:\Users\Daniel\Desktop\CAAA modulo op+admin
- ADEC:        C:\Users\Daniel\Desktop\ADEC tienda
- INNOLATTE:   C:\Users\Daniel\Desktop\Paletas INNOLATTE

Flujo de cosecha (DOC4): 1) localizar la lógica pura y sus tests → portar a packages/domain
adaptando nombres al modelo DOC5; 2) reescribir esquema con tenant_id; 3) UI al final.
NUNCA copiar: auth, manejo de env, imports cruzados, constantes de negocio.

## Definition of Done de un módulo
migraciones+RLS+test aislamiento · manifest completo · eventos producidos/consumidos
implementados · permisos registrados · server actions con Zod+guards · UI con ui-kit ·
seeds de demo · tests de domain · sección en docs/specs/mXX.md actualizada.
