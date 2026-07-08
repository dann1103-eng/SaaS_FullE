# DOCUMENTO 6 — Catálogo Unificado de Módulos
### Plataforma SaaS Modular Self-Service Multi-Tenant
*Reconciliación de las 59 propuestas de módulos de los 6 sistemas. Iteración 2.*

---

## 1. Metodología de reconciliación

Fuentes: FM CRM propuso 16 módulos, Kinetic 12 (+verticales), TAS 1 core + 8, CAAA 8, ADEC 6, INNOLATTE 8 → **59 propuestas**. Proceso aplicado:

1. **Deduplicación por capacidad**, no por nombre (el "CRM" aparece 5 veces con 5 nombres).
2. **Peso funcional a FM/Kinetic**: donde ambos linajes ya resolvieron la capacidad, su implementación es la referencia; los demás sistemas aportan lo que FM/Kinetic no tienen (ledger prepago, reservas 3D, field service, subcontratistas, pedidos, listas de precios, mantenimiento de activos, LMS, rutas, GPS).
3. **Ascenso al Core** de lo que 4+ sistemas necesitan de forma transversal (identidad, notificaciones, eventos, auditoría, archivos, búsqueda).
4. **Descenso a vertical pack** de lo que no tiene analogía cross-industria (W&B, despacho de niños, METAR).
5. **Fusiones explícitas** documentadas en §7.

Resultado: **9 servicios de Core + 26 módulos horizontales + 6 vertical packs**.

---

## 2. Vista del catálogo

Madurez: 🟩 probado en producción en ≥2 sistemas · 🟨 probado en 1 · 🟦 diseño nuevo. Prioridad preliminar: P0=MVP · P1 · P2 · P3 (el roadmap del DOC10 la refina).

### Core Platform (siempre activo, no vendible por separado)

| ID | Servicio | Referencia | Mad. |
|---|---|---|---|
| C1 | Identidad & Acceso (auth, RBAC por módulo, capacidades, impersonación, sesión única) | Kinetic/FM | 🟩 |
| C2 | Tenancy & Organizaciones (tenants, Units/marcas, settings, white-label, planes y feature flags de módulos) | FM multi-marca + diseño | 🟦/🟨 |
| C3 | Directorio Universal (Party, dimensiones configurables) | Síntesis (Doc5 §3.2, §6) | 🟦/🟩 |
| C4 | Eventos, Jobs & Automatización (bus DomainEvent, cola con claim atómico, crons, webhooks in raw-first / out por suscripción) | FM `ai_jobs` + ADEC raw-first | 🟩 |
| C5 | Notificaciones (delivery transaccional multicanal con reintentos/idempotencia + feed in-app) | ADEC+TAS+Kinetic | 🟩 |
| C6 | Archivos & Storage (buckets, URLs firmadas, compresión, ZIP con ACL) | FM/Kinetic | 🟩 |
| C7 | Auditoría (diff antes/después, actor/IP, impersonación) | CAAA+FM | 🟩 |
| C8 | Búsqueda global | TAS | 🟨 |
| C9 | Plataforma IA (runner, tool registry con scoping, tracking de costos, config por audiencia editable en runtime, guardrails) | FM | 🟨→🟩 |

### Módulos horizontales

| ID | Módulo | Referencia principal | Aportes secundarios | Mad. | Compl. | Prio. |
|---|---|---|---|---|---|---|
| M01 | CRM & Cuentas (incl. Leads) | FM `clients` | TAS jerarquía+dedupe, Kinetic families, INNO correlativos+actividad | 🟩 6/6 | Media | P0 |
| M02 | Catálogo & Precios | INNOLATTE listas | ADEC variantes+CSV, Kinetic costos, CAAA tarifas/conceptos | 🟩 5/6 | Media | P0 |
| M03 | Pedidos & Comercio | INNOLATTE armador | ADEC ingesta+clasificación+excepciones | 🟩 2/6 | Media | P1 |
| M04 | Field Service / Órdenes de trabajo | TAS boletas | CAAA máquina de estados+checklist, Kinetic sesiones | 🟩 3/6 | Alta | P1 |
| M05 | Agenda & Reservas | Kinetic motor | CAAA conflictos 3D + auto-agendamiento + publicación semanal | 🟩 3/6 | Alta | P0 |
| M06 | Facturación & Cotizaciones | FM/Kinetic | CAAA factura fiscal+recibos | 🟩 3/6 | Alta | P0 |
| M07 | Pagos & Conciliación | FM (n1co) | — (abstraer pasarela) | 🟩 2/6 | Alta | P0 |
| M08 | Recurrencia: Ciclos & Morosidad (incl. FeeRules) | FM ciclos + Kinetic | CAAA multas por frecuencia | 🟩 3/6 | Alta | P0 |
| M09 | Ledger: Saldos, Créditos & Prepago | CAAA ledger | FM créditos/wallet | 🟩 2/6 | Media | P1 |
| M10 | Pipelines & Workflows | FM 12 fases | Kinetic intake, TAS comercial | 🟩 4/6 | Alta | P1 |
| M11 | Revisión & Aprobaciones (incl. Proofing) | FM pines + TAS workflow | Kinetic informes, CAAA doble firma, ADEC excepciones | 🟩 5/6 | Alta | P1 |
| M12 | Documentos & Compliance | CAAA catálogo+vencimientos | TAS semáforo 30/60 | 🟩 2/6 | Baja-media | P2 |
| M13 | Proyectos & Subcontratistas | TAS completo | — | 🟨 | Media | P2 |
| M14 | Tiempo & Jornadas | FM/Kinetic (idéntico) | TAS horas por boleta | 🟩 3/6 | Media | P1 |
| M15 | Tareas | FM | — | 🟨 | Baja | P2 |
| M16 | Chat & Llamadas (interno) | FM/Kinetic (idéntico) | — | 🟩 2/6 | Alta | P2 |
| M17 | Mensajería Omnicanal (externo) | FM WhatsApp | — (email/SMS como canales) | 🟨 | Alta | P1 |
| M18 | Agentes IA (add-on transversal) | FM agente con tools | TAS extractor + chats sobre datos + historial narrado | 🟩 2/6 | Muy alta | P1 |
| M19 | Portal de Clientes | FM/Kinetic multi-marca | TAS portal subcontratista, CAAA autoservicio alumno | 🟩 4/6 | Alta | P1 |
| M20 | Nómina & Fiscal | Kinetic | CAAA (diseño convergente) | 🟩 2/6 | Alta | P2 |
| M21 | Egresos & Gastos | Kinetic | CAAA 22 categorías + generación automática | 🟩 2/6 | Baja | P2 |
| M22 | Activos, Mantenimiento & Inventario | CAAA Taller | — | 🟨 | Media-alta | P2 |
| M23 | Rutas & Logística | INNOLATTE | — | 🟨 | Media | P3 |
| M24 | Flota & GPS | TAS (FleetProvider) | — | 🟨 | Media | P3 |
| M25 | Reportería & Dashboards | FM/Kinetic export | TAS reporte unificado por clave, ADEC dimensiones, INNO Excel/CSV | 🟩 6/6 | Media | P0 (básico) |
| M26 | Academia / LMS | CAAA | — | 🟨 | Media | P3 |

### Vertical Packs (plantillas + módulos específicos sobre los horizontales)

| ID | Pack | Contenido específico | Base |
|---|---|---|---|
| V1 | Clínicas & Terapias | Expediente clínico, planes de tratamiento, informes de sesión/avance, reposiciones, despacho+recogida tardía, programas por grupo | Kinetic |
| V2 | Agencias & Creativos | Plantilla pipeline 12 fases, proofing preconfigurado, planes/retainers, bot de atención | FM |
| V3 | Field Service & Seguridad | Plantillas de boleta (18 campos), circuito "dato faltante" (SAP), field-to-sales, encuesta post-servicio | TAS |
| V4 | Aviación | Peso y Balance/Loadsheet, operación de vuelo (estados+checklist 19), aeronavegabilidad, METAR, kiosco torre | CAAA |
| V5 | Distribución B2B | Plantillas de pedido/listas P1–P20, códigos compuestos, rutas quincenales, exportadores | INNOLATTE |
| V6 | Comercio Escolar/Retail | Conector WooCommerce, normalizadores configurables, plantillas de reportes logísticos por dimensión | ADEC |

---

## 3. Core Platform — detalle

### C1 · Identidad & Acceso
**Objetivo:** un solo login y modelo de permisos para toda la plataforma. **Incluye:** usuarios ancla + ExternalIdentity (portales), roles por catálogo con permisos por módulo (no enums), capacidades granulares (`can_billing`/`can_work`), anti-escalada, impersonación auditada, sesión única por dispositivo, flags de onboarding (`must_change_password`, confirmación de datos). **Sustituye:** Supabase Auth ×4 + JWT custom CAAA + auth artesanal TAS (corrige el hallazgo de contraseñas en texto plano por sustitución total). **Entidades:** User, Role, Permission, ExternalIdentity, Session, ImpersonationLog. **Eventos:** `user.created`, `user.role_changed`, `session.impersonation_started`.

### C2 · Tenancy & Organizaciones
**Objetivo:** el mecanismo self-service. **Incluye:** Tenant, Units (marca/sede/CD/colegio) con theming (patrón de colores por marca de ADEC), `tenant_settings` (TZ, moneda, IVA, locale — hoy constantes salvadoreñas en 6 sistemas), **feature flags de módulos por plan** (`tenant_modules`), contadores/folios por tenant (reemplaza secuencias globales), white-label. **Semilla conceptual:** el propio TAS ya modela vistas por rol (`tabsForRol`) — el mismo mecanismo extendido a `modulesForTenant`. **Eventos:** `tenant.created`, `module.activated`, `module.deactivated`.

### C3 · Directorio Universal
**Objetivo:** Party + Dimension como sustrato de todos los módulos (Doc5 §3.2 y §6). Sin él, Catálogo/Pedidos/Reportería no pueden ser horizontales.

### C4 · Eventos, Jobs & Automatización
**Objetivo:** desacoplar los módulos entre sí (hoy: `require()` cruzados y SQL a tablas ajenas). **Incluye:** bus DomainEvent (catálogo en DOC8), cola Postgres con claim atómico + backoff (patrón `ai_jobs` FM generalizado), crons declarativos por tenant con red de seguridad (patrón ADEC), webhooks entrantes raw-first con HMAC por origen, webhooks salientes por suscripción (activa la infraestructura latente de CAAA). **Regla de oro:** ningún módulo llama funciones de otro; consume eventos o APIs internas versionadas (P11).

### C5 · Notificaciones
**Objetivo:** una sola tubería de avisos. **Incluye:** NotificationDelivery multicanal (email/WhatsApp/SMS) con plantillas por tenant/Unit, reintentos con backoff, idempotencia por índice único (ADEC), multi-transporte con prioridad + modo prueba global (TAS), auditoría de intentos; feed in-app persistente con productores por evento (resuelve el sistema "construido pero con 1 productor" de CAAA); preferencias por usuario.

### C6 · Archivos & Storage
Buckets público/privado por tenant, URLs firmadas, compresión de imágenes, descarga ZIP validando ACL, adjuntos polimórficos.

### C7 · Auditoría
AuditEntry con diff antes/después (CAAA), acciones humanas del dashboard (la carencia explícita de ADEC), impersonación (FM), sellos de inmutabilidad (planillas, facturas).

### C8 · Búsqueda global
Detección numérico/texto, resultados agrupados por entidad con detalle inline (TAS), indexación por módulo activo.

### C9 · Plataforma IA
La IA como sustrato, no como chatbot: runner de jobs IA (cola C4), **tool registry** donde cada módulo registra sus herramientas (scoped por tenant/Account), config por audiencia editable en runtime sin deploy (FM `wa_bot_configs`), prompt caching, **tracking de costos por corrida/tenant** (base del pricing por consumo), sanitizadores por canal, guardrails y handoff. Los módulos M18 (agentes) y las features IA de cada módulo consumen este sustrato.

---

## 4. Módulos horizontales — fichas

Formato: Objetivo · Qué incluye · Depende de · Entidades · Eventos clave · KPIs · Industrias · Notas de reconciliación.

### M01 · CRM & Cuentas 🟩 P0
- **Objetivo:** fuente única de verdad del cliente (Account sobre Party) para todos los demás módulos.
- **Incluye:** ficha con datos fiscales/comerciales (15 campos TAS), estados (activo/pausado/suspendido), jerarquía padre↔sucursal con dedupe case-insensitive (TAS), correlativos por prefijo (INNO), actividad derivada por recencia/churn (INNO), notas, tags, fuentes de referencia, adjuntos; **Leads**: captura (bot/manual/campo), pipeline gobernado por M10, conversión que crea Account+Contact+vínculo de conversación (FM), medición de tiempos de respuesta (TAS).
- **Depende de:** Core. **Entidades:** Account, Contact, Lead, AccountHierarchy. **Eventos:** `account.created`, `account.suspended`, `lead.converted`.
- **KPIs:** cuentas activas, churn, tiempo de respuesta a leads, conversión.
- **Industrias:** universal. **Reconciliación:** fusiona FM-M1, Kinetic-21.2, TAS-M8, INNO-1, más Leads (FM-13, TAS-3 parcial).

### M02 · Catálogo & Precios 🟩 P0
- **Objetivo:** fuente de verdad de lo vendible/agendable, con pricing determinista.
- **Incluye:** CatalogItem con variantes y códigos compuestos opcionales (INNO 3+3+3+2 con "crear componente" inline), dimensiones configurables (C3), imágenes, import CSV con validación por fila (ADEC), **motor de listas de precios** (N listas, sin fallback silencioso, excepciones por categoría — INNO), tarifas por recurso (CAAA), costos internos vs precio de cobro (Kinetic), ChargeConcepts, FeeRules paramétricas (Kinetic/CAAA).
- **Depende de:** Core. **Entidades:** CatalogItem, Variant, PriceList, Price, RateCard, ChargeConcept, FeeRule. **Eventos:** `catalog.item_created`, `price.changed`.
- **KPIs:** cobertura de precios por lista, ítems sin clasificar.
- **Industrias:** retail, distribución, servicios, clínicas, academias.

### M03 · Pedidos & Comercio 🟩 P1
- **Objetivo:** ciclo de venta transaccional: del pedido (tomado o ingerido) al despacho.
- **Incluye:** armador de pedidos con herencia de defaults + overrides auditados + recálculo server-side + snapshot + folio (INNO), estados con cambio inline; **ingesta multicanal raw-first** (webhook firmado → guardar crudo → clasificar contra catálogo por SKU → excepciones → reproceso manual + cron de respaldo, ADEC) con adaptadores por origen (WooCommerce hoy; Shopify/API después); bandeja de excepciones (patrón C-transversal instanciado); confirmaciones automáticas al comprador (C5).
- **Depende de:** M01, M02. **Entidades:** Order, OrderLine, InboundEvent, ExceptionItem. **Eventos:** `order.received`, `order.classified`, `order.needs_review`, `order.status_changed`.
- **KPIs:** % clasificación automática, tiempo en excepción, pedidos por canal.
- **Industrias:** distribución, e-commerce, retail multi-marca.

### M04 · Field Service / Órdenes de trabajo 🟩 P1
- **Objetivo:** captura y ciclo de vida de trabajo en campo con evidencia.
- **Incluye:** WorkOrder con tipos/estados configurables (máquina de estados como configuración, Doc5 §7), captura móvil con fotos tipadas + firma SVG + personal en sitio con horas individuales + materiales (TAS), checklist obligatorio pre-cierre (CAAA), "Mis órdenes" del operador, correo automático al cliente con encuesta por URL prellenada (TAS+Tally), correlación con flota (M24) y con revisión (M11).
- **Depende de:** M01; opc. M02 (materiales), M05 (si agendado). **Entidades:** WorkOrder, Execution, EvidenceItem, FormResponse. **Eventos:** `workorder.created`, `workorder.completed`, `workorder.flagged_opportunity`.
- **KPIs:** órdenes/día por técnico, tiempo de ciclo, reprocesos.
- **Industrias:** seguridad, HVAC, telecom, facilities, mantenimiento, elevadores, solar.

### M05 · Agenda & Reservas 🟩 P0
- **Objetivo:** agendar recursos con reglas de negocio reales, no un calendario decorativo.
- **Incluye:** motor de conflictos N-dimensional (recurso+operador+solicitante, CAAA) + solapamientos/duraciones/fases-terminales (Kinetic), cierres institucionales con cascada y bypass admin, capacidad contratada con semáforo de ocupación (Kinetic), horarios de recurso, drag&drop, reasignación/cobertura, eventos multi-persona, **auto-agendamiento del cliente final** con límites configurables por regla (CAAA alumno → portal M19), flujo borrador→publicación en lote con creación de la semana siguiente (CAAA), inasistencias con sugeridor de reposición en ventana (Kinetic), generación WYSIWYG desde Agreements (M08).
- **Depende de:** M01; Resources en C3. **Entidades:** Resource, Booking, CalendarClosure, Absence. **Eventos:** `booking.created`, `booking.completed`, `booking.cancelled`, `schedule.published`.
- **KPIs:** ocupación vs capacidad, no-shows, reposiciones dentro de ventana.
- **Industrias:** clínicas, academias, escuelas de vuelo/manejo, salones, talleres, salas.

### M06 · Facturación & Cotizaciones 🟩 P0
- **Objetivo:** documentos fiscales con snapshot e integridad.
- **Incluye:** facturas/cotizaciones con numeración por tenant, IVA/retención parametrizables, snapshot fiscal (P2), DTE como plugin de localización (SV primero), PDFs server-side con branding (FM/Kinetic + pdfkit CAAA con watermark de anulación), conversión cotización→factura, facturas ad-hoc y de extras, recibos de depósito (CAAA), anulación auditada.
- **Depende de:** M01, M02. **Entidades:** Invoice, InvoiceLine, Quote. **Eventos:** `invoice.issued`, `invoice.paid`, `invoice.voided`, `quote.accepted`.
- **KPIs:** emisión, DSO, anulaciones.
- **Industrias:** universal.

### M07 · Pagos & Conciliación 🟩 P0
- **Objetivo:** cobrar online y conciliar sin intervención.
- **Incluye:** payment links con expiración y metadata (FM), webhook raw-first con firma + auditoría SIEMPRE + idempotencia, matching por prioridades (referencia→suscripción→email→**huérfano** a bandeja de excepciones), aplicación de pago con efectos (extras→créditos M09), callback UX separado de la fuente de verdad, **pasarela tras interfaz `PaymentProvider`** (n1co primero; Stripe después).
- **Depende de:** M06. **Entidades:** PaymentEvent, Payment. **Eventos:** `payment.received`, `payment.orphaned`, `payment.matched`.
- **KPIs:** % conciliación automática, huérfanos, tiempo link→pago.

### M08 · Recurrencia: Ciclos & Morosidad 🟩 P0
- **Objetivo:** el motor de ingresos recurrentes — la capacidad más monetizable del corpus.
- **Incluye:** Agreements (planes/retainers/planes de tratamiento) → generación de Cycle + factura anticipada (cron diario, FM 10 días antes), links de pago, mora por FeeRule, **período de gracia configurable**, suspensión/reactivación automática con gate operativo ("semana pagada" FM), renovación, rollover de unidades no consumidas (Kinetic), modalidad flat vs por consumo, preview WYSIWYG de lo que se generará (Kinetic).
- **Depende de:** M06, M07; sinergia M05 (genera Bookings del ciclo). **Entidades:** Agreement, Cycle. **Eventos:** `cycle.generated`, `cycle.overdue`, `account.suspended_nonpayment`, `cycle.renewed`.
- **KPIs:** MRR, morosidad, churn por suspensión, recuperación en gracia.
- **Industrias:** clínicas, academias, agencias, gimnasios, SaaS, membresías.

### M09 · Ledger: Saldos, Créditos & Prepago 🟩 P1
- **Objetivo:** contabilidad de saldo por cliente, auditable e inmutable.
- **Incluye:** LedgerEntry append-only con tipos configurables, saldo cacheado, edición con recálculo en cascada, anulación por contrapartida (CAAA), depósitos con recibo, cargos automáticos por evento (`booking.completed` → cargo por tarifa), créditos/packs sin caducidad con consumo y refund idempotente (FM), extracto y morosos (<umbral configurable).
- **Depende de:** M01; M02 (tarifas); sinergia M06/M07. **Entidades:** LedgerAccount, LedgerEntry. **Eventos:** `ledger.charged`, `ledger.deposited`, `ledger.balance_low`.
- **Industrias:** prepago (escuelas, gimnasios, spas, clínicas por paquete), wallets.

### M10 · Pipelines & Workflows 🟩 P1
- **Objetivo:** un motor kanban/estados para cualquier entidad.
- **Incluye:** Pipeline/Stage/Transition configurables con log, efectos declarativos por transición (crear registro, notificar, cancelar dependencias, emitir evento), kanban DnD + panel de detalle (FM), timers por fase (FM+M14), sub-fases y alertas de estancamiento (Kinetic: urgentes >14 días), plantillas de fábrica por vertical (12 fases agencia, 17 intake clínica, field-to-sales).
- **Depende de:** Core; gobierna entidades de cualquier módulo. **Eventos:** `pipeline.stage_changed`, `pipeline.stalled`.
- **Industrias:** ventas, soporte, producción, admisiones, RRHH.

### M11 · Revisión & Aprobaciones 🟩 P1
- **Objetivo:** el MP1 como producto — la capacidad más repetida del corpus (5/6).
- **Incluye:** ReviewableDocument genérico (draft→submitted→approved/rejected→delivered) con colas por responsable, edición auditada con detección real de cambios + aviso al afectado (TAS), comentario interno, marca de reproceso, circuito "dato faltante → responsable → regresa a cola" generalizado del caso #SAP (TAS), métricas de tiempos por revisor; **Proofing visual** como capacidad premium: assets/versiones con gating de pines activos, pines posicionales sobre imagen/video/PDF, hilos, menciones, aprobación del cliente desde portal (FM); doble firma ordenada (CAAA); detección de documentos pendientes por responsable (Kinetic).
- **Depende de:** Core; se adjunta a WorkOrders (M04), Pipelines (M10), Portal (M19). **Eventos:** `document.submitted`, `document.approved`, `document.rejected`, `document.needs_data`.
- **KPIs:** tiempo de revisión, % reprocesos, pendientes por responsable.
- **Industrias:** agencias, clínicas, field service, legal, arquitectura, QA.

### M12 · Documentos & Compliance 🟩 P2
- **Objetivo:** "qué documento necesita quién y cuándo vence".
- **Incluye:** catálogo configurable por tipo de Party/Account (contratos como filas del catálogo, CAAA), estados, subida con URL firmada, autoservicio de descarga, alertas de vencimiento a N días + semáforo 30/60 (TAS), aplicable a clientes, empleados, alumnos y trabajadores de proveedores.
- **Depende de:** M01, C6. **Eventos:** `compliance.expiring`, `compliance.expired`.
- **Industrias:** RRHH, salud, seguros, contratistas, industrias reguladas.

### M13 · Proyectos & Subcontratistas 🟨 P2
- **Objetivo:** trabajo ejecutado por terceros bajo control.
- **Incluye:** Project con plazo en días hábiles y estados autocalculados (por_iniciar/en_progreso/en_riesgo/vencido), actividades de catálogo con % acumulado, portal móvil del proveedor, reporte diario multi-actividad con fotos checkin/evidencia/checkout + firma, aprobación con observaciones (usa M11), 6 avisos de ciclo de vida por cron, métricas de confiabilidad por Vendor, RRHH de contratistas (roster + compliance vía M12).
- **Depende de:** M01 (Vendors), M11, M12, C5. **Eventos:** `project.at_risk`, `project.overdue`, `progress.approved`.
- **Industrias:** construcción, integradores, facility management, outsourcing.

### M14 · Tiempo & Jornadas 🟩 P1
- **Objetivo:** jornadas + timers + productividad. **Incluye:** clock-in/out con breaks, timer único por usuario con guards (FM), timers por fase/tarea/administrativo, edición admin auditada, timesheets exportables, online-vs-productivo. **Depende de:** Core. **Alimenta:** M20 (nómina), M25. **Industrias:** universal.

### M15 · Tareas 🟨 P2
Asignación con estados, reasignación, timer integrado (M14), notificaciones. Ligero por diseño.

### M16 · Chat & Llamadas 🟩 P2
- **Incluye:** DMs/canales realtime, menciones, adjuntos, reply, share-cards de entidades de otros módulos, dock flotante; llamadas voz/video/pantalla (LiveKit agnóstico), ring/perdidas, presencia con estado+emoji. Motor idéntico ya en FM y Kinetic — extracción casi directa.
- **Industrias:** universal (reemplaza Slack ligero + Meet interno).

### M17 · Mensajería Omnicanal (externa) 🟨 P1
- **Objetivo:** conversaciones con clientes/leads por canal (WhatsApp Cloud API primero; email/SMS después) — separado del agente IA.
- **Incluye:** webhook Meta firmado + idempotencia por `wamid`, media a storage privado, matching contacto→Account multi-marca con marca activa sticky (FM), plantillas registradas (HSM), intervención de staff, bandera `needs_attention`, inbox omnicanal.
- **Depende de:** M01, C4, C5. **Eventos:** `conversation.inbound`, `conversation.needs_attention`.

### M18 · Agentes IA (add-on premium transversal) 🟩 P1
- **Objetivo:** IA que ejecuta, no que conversa.
- **Incluye:** (a) **Agente omnicanal** con tool-use loop, tools registradas por cada módulo activo (el catálogo de 18 tools de FM se reparte entre M01/M06/M07/M08/M10/M19), debounce, handoff, saludo institucional, costos por tenant (C9); (b) **Captura conversacional de formularios**: narración voz/texto → JSON tipado con vocabularios controlados + repreguntas con chips + confirmación editable (TAS), parametrizada por ExtractionSchema = FormDefinition; (c) **Chat sobre datos operativos** por módulo con contexto/RAG (TAS, a re-arquitecturar sobre tools); (d) **Historial narrado** de un Account para personal de campo (TAS); (e) transcripción de voz (Whisper) como servicio.
- **Depende de:** C9 + los módulos que consulte. **Pricing:** por consumo (el tracking de costos ya existe).
- **Nota estratégica:** es el diferenciador AI-native de la plataforma; ningún competidor del segmento PyME LatAm lo ofrece integrado con acciones reales de negocio.

### M19 · Portal de Clientes 🟩 P1
- **Objetivo:** self-service del cliente final del tenant.
- **Incluye:** shell de portal con permisos granulares por ExternalIdentity (`can_billing`/`can_work`), multi-marca con selección sticky (FM), vistas gateadas por RLS de los módulos activos (agenda, facturas+pago, documentos, pipeline/entregables, aprobaciones M11), solicitudes (contenido/cambios/citas) con elegibilidad compartida bot↔portal (P11), compra de extras, auto-agendamiento (M05), agenda digital/journal (Kinetic).
- **Depende de:** M01 + los módulos que exponga. **Eventos:** `portal.request_created`, `portal.approved_review`.

### M20 · Nómina & Fiscal 🟩 P2
- **Incluye:** planillas mensuales/quincenales, dos regímenes (planta ISSS/AFP/ISR por tramos + servicios profesionales), config fiscal versionada por vigencia y **por país** (SV de fábrica), sellado inmutable con snapshot, recibos PDF + firma digital del empleado, insumos por evento (`workorder.completed` con horas → pago por servicio; `evaluation.passed` → pago de teoría CAAA), egreso automático al pagar (M21).
- **Depende de:** C1 (empleados), M14 opcional. **Convergencia Kinetic↔CAAA = validación doble del diseño.**

### M21 · Egresos & Gastos 🟩 P2
Registro de gastos con categorías configurables por tenant, generación automática desde eventos (nómina pagada, consumo de inventario), alimenta P&L (M25).

### M22 · Activos, Mantenimiento & Inventario 🟨 P2
- **Incluye:** Assets con componentes, tareas programadas por horas/ciclos/fecha con "reset de reloj" al cumplir, bloqueo operativo del activo (cierra el gap legado/Taller de CAAA: el bloqueo pasa a ser efecto de transición), caché de próxima revisión (P10), inventario de repuestos con kardex y egreso automático al consumir, horas del activo alimentadas por eventos (`workorder.completed`).
- **Industrias:** flotas, maquinaria, equipos médicos, aviación.

### M23 · Rutas & Logística 🟨 P3
Horario de zonas (grupos quincenales × días), GeoAreas normalizadas (corrige la relación por texto de INNO), hoja de ruta diaria con clientes a visitar + pendientes de entrega + importes, presets por día, export PDF, toggle con-pedido.

### M24 · Flota & GPS 🟨 P3
Adapter `FleetProvider` (Geotab primero): paradas del día >N min geocodificadas por lotes, ruta por WorkOrder vía placa normalizada, mapa con polilínea, sesión cacheada con retry.

### M25 · Reportería & Dashboards 🟩 P0 (básico) / P1 (avanzado)
- **Incluye:** KPIs por rol y módulo, dashboards con filtros por dimensión (C3 — generaliza la reportería ADEC), gráficas, comparativas por responsable (TAS supervisores), P&L + morosos (CAAA), productividad (FM/Kinetic), **reporte unificado por clave externa** (une N fuentes por referencia — el SAP Call Report de TAS generalizado), factory de exportadores (PDF server @react-pdf + pdfkit, Excel estilizado ExcelJS 2 hojas, CSV con BOM, jsPDF cliente), respetando filtros de URL (INNO).
- **Depende de:** los módulos activos (agregador por definición).

### M26 · Academia / LMS 🟨 P3
Cursos→unidades→materiales, evaluaciones interno/autoridad-externa con auto-matrícula, asistencia precargada, progreso teórico + práctico por categoría de actividad (alimentado por eventos de M04/M05), disparadores hacia M20 y C5.

---

## 5. Grafo de dependencias consolidado (base del DOC7)

```
                          ┌──────────────── CORE C1–C9 ────────────────┐
                          │  (requerido por todos los módulos)          │
                          └────────────────────┬────────────────────────┘
                                               │
   M01 CRM ◄──── base de ────┬──────────┬──────┴──────┬───────────┬──────────┐
     │                       │          │             │           │          │
     ├─► M02 Catálogo ──► M03 Pedidos   │             │           │          │
     │        │             │           │             │           │          │
     │        ├─► M05 Agenda ◄── Agreements ── M08 Recurrencia    │          │
     │        │      │                          ▲     │           │          │
     │        │      ├─► M04 Field Service      │     │           │          │
     │        │      │        │                 │     │           │          │
     │        │      │        ├─► M11 Revisión ─┼─────┼─► M19 Portal         │
     │        │      │        └─► M24 Flota     │     │      ▲               │
     │        │      └─► M09 Ledger ◄───────────┘     │      │               │
     │        │                ▲                      │      │               │
     │        └─► M06 Facturación ──► M07 Pagos ──────┘      │               │
     │                                                        │               │
     ├─► M10 Pipelines (gobierna entidades de cualquier módulo)               │
     ├─► M13 Subcontratistas ──► M11, M12                                     │
     ├─► M17 Omnicanal ──► M18 Agentes IA (consume tools de módulos activos) ─┘
     │
     M14 Tiempo ──► M20 Nómina ──► M21 Egresos ──► M25 Reportería ◄── (todos)
     M15 Tareas ──► M14          M22 Activos ◄── eventos de M04/M05
     M16 Chat (transversal)      M12 Compliance (transversal)
     M23 Rutas ◄── M01 (zonas) + M03 (pendientes)     M26 LMS ◄── M04/M05/M20
```

**Instalables solos** (Core + módulo): M01, M02, M14, M15, M16, M25-básico, M12.
**Cadenas mínimas:** Facturar = M01+M02+M06. Cobrar recurrente = +M07+M08. Agendar = M01+M05. Campo = M01+M04. Vender IA = M17+M18+lo que consulte.

---

## 6. Bundles comerciales (síntesis de los propuestos por sistema)

| Bundle | Módulos | Vertical origen |
|---|---|---|
| **Servicios Recurrentes** (el buque insignia) | Core+M01+M02+M05+M06+M07+M08+M19+M25 | FM+Kinetic |
| **Agencia Creativa** | Recurrentes + M10+M11+M14+M16+M17+M18 + V2 | FM |
| **Clínica & Terapias** | Recurrentes + M09+M20+M21 + V1 | Kinetic |
| **Field Service** | Core+M01+M04+M11+M25 (+M13+M24+M18) + V3 | TAS |
| **Distribución B2B** | Core+M01+M02+M03+M23+M25 + V5 | INNOLATTE |
| **Academia/Operación de Flota** | Core+M01+M05+M09+M20+M22+M26 + V4 | CAAA |
| **Colaboración** (entry-level) | Core+M14+M15+M16+M25 | FM/Kinetic |

---

## 7. Fusiones y eliminaciones (decisiones tomadas)

| Propuesta original | Decisión |
|---|---|
| FM "Calendario" (mód. 11) | **Fusionado** en M05 Agenda (un calendario sin motor de reglas no es módulo). |
| FM "Créditos/Wallet" (mód. 15) | **Fusionado** en M09 Ledger (es un caso particular). |
| FM "Leads" (mód. 13) + TAS "Pipeline comercial" (mód. 3) | **Fusionados** en M01 (datos) + M10 (workflow) + M18 (chat comercial IA). |
| ADEC "Notificaciones Transaccionales" (21.3) | **Ascendido** a Core C5. |
| ADEC "Bandeja de Excepciones" (21.4) | **Ascendido** a patrón transversal (P7): instancias en M03, M07, M11. |
| ADEC "Identidad y Acceso" (21.6) + INNO "Identidad" (7) + TAS núcleo | **Ascendidos** a Core C1/C2. |
| TAS "Captura IA" (mód. 5) + chats IA + historial narrado | **Fusionados** en M18 sobre C9. |
| TAS "Workflow de revisión" (mód. 2) + FM "Proofing" (mód. 6) + Kinetic "Documentos & Revisión" (21.9) | **Fusionados** en M11 (aprobación genérica + proofing como capacidad premium). |
| Kinetic "Nómina" (21.5) ↔ CAAA "Nómina" (21.2) | **Fusionados** en M20; referencia Kinetic, reglas validadas contra CAAA. |
| CAAA "Operación en Tiempo Real" (21.7) | **Repartido**: máquina de estados → Doc5 §7 (Core config); kiosco/tablero → widget de M25; estados de vuelo → V4. |
| CAAA "Peso y Balance" (21.8) | **Vertical puro** → V4 (sin generalización, por diseño). |
| ADEC "Reportería por Dimensiones" + INNO "Analítica"+"Reportería" + TAS "Analítica" + Kinetic/FM "Reportería" | **Fusionados** en M25 con dimensiones de C3. |
| TAS "Flota" / INNO "Rutas" / CAAA "Taller" / CAAA "LMS" | **Se mantienen** como módulos independientes (M24/M23/M22/M26): dominios reales con compradores propios. |
| Tablas y auth legacy (TAS `tecnicos`, CAAA mantenimiento admin, contraseñas plaintext) | **Eliminados** — se migran datos, no diseño. |

---

## 8. Cobertura del catálogo vs. lista original de conceptos

Verificación contra la lista del brief (CRM, marketing, portal, facturación, cobros, chatbots, WhatsApp, documental, tareas, time tracking, agendas, clínicas, terapias, escuelas, aviación, inventarios, catálogos, pedidos, comercio, reportes, dashboards, rutas, proyectos, tickets, servicio técnico, firmas, formularios, automatizaciones, workflows): **29/29 cubiertos** — "tickets" se modela como WorkOrder+Pipeline (M04+M10), "firmas digitales" como EvidenceItem/firma de documentos (M04/M11/M20), "formularios" como FormDefinition (C-transversal + M18), "marketing/producción de contenido" como V2 sobre M10+M11.

---

*Siguientes documentos de la serie: DOC7 (grafo formal de dependencias), DOC8 (catálogo de eventos), DOC9 (arquitectura AI-first sobre C9/M18), DOC3 (Core Platform en profundidad), DOC10 (roadmap con prioridades P0–P3 refinadas).*
