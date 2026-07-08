# DOCUMENTO 12 — Plan de Acción: Implementación con Claude Code
### Del papel al repositorio
*Iteración 3. Este documento es el manual de arranque: qué falta decidir, cómo montar el repo, y cómo dirigir a Claude Code sesión por sesión.*

---

## 1. Lo que falta ANTES de escribir código (checklist de prerrequisitos)

**Decisiones de producto (tuyas, 1–2 días):**
- [ ] **Nombre y dominio** de la plataforma (afecta paquetes, buckets, emails).
- [ ] **Bundle y vertical del primer design partner** (recomendado DOC10: Servicios Recurrentes; ideal 1 agencia + 1 clínica/academia nuevas).
- [ ] **Precios v0** (aunque sean placeholder: base + por módulo; necesario para modelar `plans` en Fase 0).
- [ ] **Idiomas v1** (recomendado: solo es-419; en inglés después).

**Cuentas e infraestructura (medio día):**
- [ ] Org GitHub + repo privado `plataforma` · Org Vercel · **Proyecto Supabase nuevo** (Pro; region us-east-1 como los donantes) — separado de todo cliente existente.
- [ ] API keys: Anthropic (agente), OpenAI (Whisper, fase 2), Resend (dominio verificado de la plataforma).
- [ ] n1co: **conversación comercial** — confirmar si soportan sub-comercios/split o si cada tenant registra su cuenta y guarda sus credenciales (el diseño `PaymentProvider` con credenciales por tenant cubre ambos; hay que saber cuál aplicar).
- [ ] Meta/WhatsApp: NO bloquea el MVP (agente en portal web primero), pero iniciar el papeleo de Tech Provider / Embedded Signup en Fase 1 porque tarda semanas.

**Material de trabajo:**
- [ ] Acceso de lectura a los 6 repos donantes desde tu máquina (Claude Code los usará como referencia de cosecha).
- [ ] Los 12 documentos (esta serie) dentro del repo en `docs/`.

**Legal (paralelo, no bloquea Fase 0):** términos de servicio, privacidad, DPA básico — necesarios antes de la GA privada, no antes del código.

## 2. Setup del repositorio (Sesión 0 con Claude Code)

```bash
# estructura objetivo (DOC3 §0)
plataforma/
├── CLAUDE.md                      # §3 de este documento
├── docs/                          # DOC1..DOC12 + docs/adr/ + docs/specs/
├── apps/web/
├── packages/{db,core,domain,ui,modules}/
├── supabase/{migrations,functions}/
└── tooling/
```

Instrucción literal para la primera sesión:
> "Lee CLAUDE.md y docs/DOC3-Core-Platform.md. Crea el scaffold Turborepo con esa estructura exacta: Next.js App Router en apps/web con TypeScript estricto, Tailwind 4, packages vacíos con tsconfig compartido, Supabase CLI inicializado, CI de GitHub Actions con typecheck+lint+test, y un README que apunte a docs/. No implementes lógica de negocio todavía."

## 3. CLAUDE.md (contenido inicial — copiar al repo)

```markdown
# Plataforma [NOMBRE] — Constitución del repositorio

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
[rutas locales a fm_full_y_connect, kinetic, tas, caaa, adec-tienda, innolatte]
Flujo de cosecha (DOC4): 1) localizar la lógica pura y sus tests → portar a packages/domain
adaptando nombres al modelo DOC5; 2) reescribir esquema con tenant_id; 3) UI al final.
NUNCA copiar: auth, manejo de env, imports cruzados, constantes de negocio.

## Definition of Done de un módulo
migraciones+RLS+test aislamiento · manifest completo · eventos producidos/consumidos
implementados · permisos registrados · server actions con Zod+guards · UI con ui-kit ·
seeds de demo · tests de domain · sección en docs/specs/mXX.md actualizada.
```

## 4. Flujo de trabajo con Claude Code (método)

1. **Una unidad de trabajo por sesión/branch** (un servicio del Core o un módulo o una porción clara de módulo). Contexto de arranque: "Lee CLAUDE.md, docs/specs/mXX.md y las secciones relevantes de DOC5/DOC6/DOC8".
2. **Spec antes de código:** para cada módulo, primera tarea = Claude Code redacta `docs/specs/mXX.md` (esquema de tablas, actions, eventos, pantallas) **derivado de DOC6 + la doc del donante**; tú lo apruebas; segunda tarea = implementación. Esto convierte tus 6 documentaciones en specs ejecutables.
3. **Cosecha dirigida:** cuando toque lógica donante, la instrucción incluye la ruta exacta ("porta `kinetic/src/lib/domain/billing/late-fee.ts` y sus tests a `packages/domain/billing/fee-rules.ts`, parametrizando los valores según DOC5 §3.3 FeeRule").
4. **Ritmo de PRs pequeños:** migración+RLS en un PR; domain+tests en otro; actions+UI en otro. CI verde obligatorio.
5. **ADRs para toda desviación:** si Claude Code propone algo distinto a los docs, se registra en `docs/adr/NNN-titulo.md` y se actualiza el doc afectado — los documentos viven en el repo justamente para eso.
6. **Al final de cada sesión:** actualizar `docs/specs/mXX.md` y el estado en un `ROADMAP.md` raíz (checklist de DOC10) para que la siguiente sesión arranque con contexto fresco.

## 5. Plan de sesiones — Fase 0 + Fase 1 (orden concreto)

| # | Sesión (≈1 branch/PR c/u) | Entrada principal |
|---|---|---|
| 0 | Scaffold monorepo + CI + CLAUDE.md | DOC3 §0, §3 de este doc |
| 1 | Migración 0001 tenancy + RLS template + test de aislamiento + seeds | DOC3 §1 |
| 2 | C1 Auth (Supabase Auth + memberships + JWT claims + middleware + requirePermission) | DOC3 §2 |
| 3 | C4 outbox domain_events + jobs (cosecha runner FM) + cron tick | DOC3 §3, donante FM |
| 4 | C5 notificaciones (deliveries idempotentes + feed + transporte email) | DOC3 §4, donantes ADEC/TAS |
| 5 | C7 audit + C6 storage helpers + C3 dimensiones + ui-kit base (cosecha tokens FM/Kinetic) | DOC3, DOC5 §6 |
| 6 | Registro self-service + tenant_modules + manifest loader + navegación dinámica | DOC3 §1, DOC7 §4 |
| 7 | **M01 CRM** (spec→schema→domain→UI; jerarquía+dedupe de TAS) | DOC6 M01, DOC4 |
| 8 | **M02 Catálogo** (ítems+variantes+precios simples+FeeRules; import CSV de ADEC) | DOC6 M02 |
| 9 | **M06 Facturación** (cosecha invoice-create FM + PDF) | DOC6 M06 |
| 10 | **M07 Pagos** (interfaz PaymentProvider + adapter n1co + webhook raw + matcher) | DOC6 M07, donante FM |
| 11 | **M08 Recurrencia** (ciclos+mora+gracia+suspensión; cron diario) | DOC6 M08, donantes FM/Kinetic |
| 12 | **M05 Agenda** (motor Kinetic: solapamientos, cierres, drag&drop, capacidad) | DOC6 M05, donante Kinetic |
| 13 | **M19 Portal v1** (shell + facturas + pagar + agenda lectura + solicitudes) | DOC6 M19 |
| 14 | **M25 Reportería básica** (KPIs + exportadores de INNO/Kinetic) | DOC6 M25 |
| 15 | **C9 + agente de lectura en portal** (runtime+registry+metering; tools M01/M06/M08) | DOC9 v1 |
| 16 | Hardening MVP: rate limiting, e2e del flujo dinero, seeds de demo, onboarding UX | DOC10 criterio de salida F1 |

Después de la sesión 16: design partners reales → feedback → Fase 2 (DOC10).

## 6. Qué NO delegar a Claude Code

Decisiones de precio y alcance de bundles · negociación n1co/Meta · aprobación de specs y ADRs · revisión de toda migración que toque RLS o dinero (tu firma manual) · la venta a los design partners.

## 7. Resumen ejecutivo del arranque

Con los prerrequisitos del §1 resueltos (≈2–3 días de gestiones), el camino es: **Sesión 0 hoy → Core en las sesiones 1–6 → MVP funcional al cierre de la sesión 16**. Todo el conocimiento necesario ya está en `docs/` y en los seis repos donantes; el trabajo de Claude Code es traducción disciplinada, no invención.
