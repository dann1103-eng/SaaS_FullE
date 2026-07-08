# DOCUMENTO 5 — Modelo de Dominio Unificado
### Plataforma SaaS Modular Self-Service Multi-Tenant
*Derivado del análisis de FM CRM, Kinetic CRM, TAS Platform, CAAA, ADEC Tienda e INNOLATTE. Iteración 2.*

---

## 0. Cómo leer este documento

Este modelo **no preserva** los esquemas actuales: los cuestiona y los reemplaza por entidades universales. Cada entidad indica su origen (qué sistema aporta la implementación de referencia) y su grado de prueba en producción. La convención de peso acordada: **FM CRM y Kinetic son la columna vertebral funcional** (genoma compartido probado en dos verticales); los demás sistemas aportan motores especializados que FM/Kinetic no tienen.

---

## 1. Principios de modelado (extraídos, no inventados)

Estos 12 principios aparecen repetidos en los sistemas y se elevan a ley de la plataforma:

| # | Principio | Origen probado |
|---|---|---|
| P1 | **Ancla + extensiones**: una tabla de identidad única con extensiones 1:1 opcionales por rol/tipo, creadas perezosamente | CAAA (`usuario`→`alumno`/`instructor`/`empleado`), TAS (`usuarios` unificada) |
| P2 | **Snapshot inmutable** en todo documento transaccional: líneas, precios, datos fiscales y términos se congelan al emitir | INNOLATTE (`pedido_items`), FM (invoices/ciclos), Kinetic (planillas selladas), ADEC (`raw_payload`) |
| P3 | **Ledger append-only**: los movimientos económicos nunca se borran; se anulan con contrapartida | CAAA (`movimiento_cuenta`) — el diseño contable más limpio del corpus |
| P4 | **Idempotencia por índices únicos parciales** como invariante de negocio en BD, no solo en código | ADEC (correo por orden+destinatario), FM (jobs, pagos), Kinetic |
| P5 | **Ingesta raw-first**: todo evento externo se persiste crudo ANTES de interpretarse; responder rápido, procesar async, cron de respaldo | ADEC (`webhook_events`), FM (`n1co_payment_events`, webhook Meta) |
| P6 | **Máquina de estados explícita con bitácora de transiciones** (quién, cuándo, diff) | CAAA (`vuelo_estado_tiempo`), FM (`phase_logs`), Kinetic (`child_phase_history`) |
| P7 | **Human-in-the-loop por diseño**: lo que el sistema no puede resolver va a una bandeja de excepciones con motivo y acción de reproceso; nunca se adivina ni se pierde | ADEC (`para_revision`), FM (pagos huérfanos), TAS (`pendiente_llamada`) |
| P8 | **Dimensiones configurables por tenant**: los ejes de clasificación (colegio/sede/grado, canal/CD/etiqueta/distrito, servicio/grupo) son datos, no columnas | Lección negativa de ADEC e INNOLATTE (hoy hardcodeadas) |
| P9 | **Defensa en profundidad**: cada regla crítica vive en UI + acción de servidor + RLS/trigger | FM (pago/suspensión), INNOLATTE (3 capas), Kinetic |
| P10 | **Caché sincronizada para migración incremental**: cuando un módulo nuevo asume la fuente de verdad, sincroniza una caché para no romper consumidores legados | CAAA (`aeronave.horas_proxima_revision`) |
| P11 | **Core compartido + adaptadores por canal**: la lógica de negocio es una; portal, bot, staff y API son adaptadores | FM (`invoice-create.ts` compartido por portal y bot IA) |
| P12 | **TZ-safety y dinero disciplinado**: zona horaria del tenant en todo cálculo de fechas; `numeric` con reglas de redondeo únicas (`round6` en tubería, `round2` en agregados) | INNOLATTE, FM (GMT-6), Kinetic |

---

## 2. Los cinco meta-patrones (el ADN real de los seis sistemas)

Antes de las entidades, los cinco patrones estructurales que se repiten y que la plataforma debe modelar UNA sola vez:

### MP1 — El Documento Revisable
`borrador → enviado → (en revisión) → aprobado | rechazado → entregado/publicado`, con editor auditado, comentarios, notificación al aprobar y métricas de tiempos.
**Aparece 5 veces:** boleta TAS, informe clínico Kinetic, asset de contenido FM (proofing con pines), reporte de vuelo CAAA (doble firma), orden en excepción ADEC. Y una sexta variante: avance de subcontrato TAS.

### MP2 — El Motor Económico
`Acuerdo recurrente → Ciclo → Factura → Link de pago → Webhook → Conciliación → Ledger`, con recargos (mora, tarifas por tiempo, multas por frecuencia), gracia, suspensión y rollover.
**Aparece 4 veces:** ciclos FM, ciclos mensuales Kinetic, saldo prepagado CAAA, facturado-flag INNOLATTE. Tres filosofías (postpago recurrente, prepago con ledger, cobro puntual) que un único núcleo Ledger+Facturación+Recurrencia unifica.

### MP3 — Reserva → Ejecución → Evidencia
Un **Recurso** (aeronave, terapista, vehículo, técnico) se reserva en un slot para un **Solicitante**, la reserva se convierte en **ejecución con máquina de estados**, y la ejecución produce **evidencia** (checklist, fotos tipadas, firma, reporte) que dispara consecuencias económicas (MP2).
**Aparece 4 veces:** vuelo CAAA (el más completo: conflictos 3D + checklist 19 ítems + cargo automático), cita/sesión Kinetic, boleta TAS, requirement FM.

### MP4 — El Pipeline Configurable
Tablero kanban de fases con transiciones auditadas y **efectos por transición** (crear registro, notificar, cancelar dependencias).
**Aparece 4 veces y ya gobierna 3 dominios distintos con el mismo motor:** producción FM (12 fases), intake Kinetic (17 subfases — crea familia+niño al inscribir), comercial TAS (field-to-sales), publicación de semanas CAAA.

### MP5 — Conversación Omnicanal + Agente IA
Conversaciones con contactos externos (WhatsApp hoy) donde un agente IA con **herramientas de negocio reales** atiende, ejecuta (facturar, agendar, consultar) y hace handoff a humano; y en paralelo, IA que **extrae formularios estructurados de narración libre** (voz/texto).
**Aparece 2 veces en forma madura y complementaria:** FM (agente transaccional: 18 tools, cola de jobs, prompt caching, tracking de costos) y TAS (extractor conversacional 18 campos + chats sobre datos + historial narrado). No hay que inventar la capa IA: hay que generalizarla.

---

## 3. Modelo de entidades universal

Notación: `Entidad` (madurez = en cuántos sistemas existe hoy alguna encarnación / referencia = implementación semilla).

### 3.1 Identidad y Tenancy — *el retrofit universal*

| Entidad | Definición | Ref. |
|---|---|---|
| **Tenant** | La empresa cliente de la plataforma. Hoy NO existe en ningún sistema (0/6): toda tabla de negocio recibe `tenant_id` + RLS por tenant. | — (diseño nuevo) |
| **Unit** | Unidad operativa dentro del tenant: marca (FM multi-marca), colegio/sede (ADEC), CD/planta (INNOLATTE), sucursal. Con theming propio (colores de correo ADEC ya lo hace por marca). | FM `client_users` multi-marca, ADEC `colegios` |
| **User** | Identidad ancla de staff (P1). Roles, capacidades, sesión única, impersonación auditada, último acceso, `must_change_password`-style flags. | Kinetic (12 roles, anti-escalada) + FM |
| **Role / Permission** | RBAC por módulo + capacidades granulares (`can_billing`, `can_work`). Los roles dejan de ser enum: catálogo por tenant con permisos por módulo. | FM/Kinetic + lección INNOLATTE |
| **ExternalIdentity** | Usuario externo del portal (padre, cliente, subcontratista) vinculado a una o N Accounts con capacidades. | FM `client_users`, Kinetic `family_users`, TAS `subcontratos_usuarios` |
| **ImpersonationLog / Session** | Suplantación auditada ("modo espectador") y sesión única por dispositivo. | FM/Kinetic |

### 3.2 Partes y Directorio (Party Model)

| Entidad | Definición | Ref. |
|---|---|---|
| **Party** | Persona u organización, independiente del rol comercial. Unifica: contacto, encargado, alumno-persona, trabajador de subcontratista, médico autorizado. | Patrón CAAA generalizado |
| **Account** | Relación comercial del tenant con una Party: cliente (FM/TAS/INNO), familia (Kinetic), alumno (CAAA), encargado (ADEC). Con estado, plan, datos fiscales, notas, tags, fuente de referencia. **Jerarquía padre/sucursal** con dedupe (TAS). **Actividad derivada** por recencia (INNOLATTE). | FM `clients` + Kinetic `families` + TAS jerarquía |
| **Contact** | Persona de contacto de una Account (multi-contacto, teléfonos E.164 para omnicanal). | FM `client_whatsapp_contacts` |
| **Lead** | Prospecto pre-Account con pipeline propio (MP4) y conversión que crea Account+Contact+vínculo de conversación. | FM `wa_leads` + TAS oportunidades |
| **Vendor / VendorWorker** | Proveedor externo (empresa subcontratista) + su roster con datos de compliance (DUI, ISSS, vencimiento de exámenes → ver ComplianceDocument). | TAS M8b |

### 3.3 Catálogo y Precios

| Entidad | Definición | Ref. |
|---|---|---|
| **CatalogItem** | Producto o servicio vendible/agendable. Código estructurado opcional por componentes (INNOLATTE 3+3+3+2), variantes (tallas ADEC), costo interno vs precio de cobro (Kinetic `service_catalog`). | INNO+ADEC+Kinetic |
| **Variant / Dimension / DimensionValue** | Ejes de clasificación configurables por tenant (P8): reemplazan colegio/sede/grado, canal/CD/etiqueta, categoría/familia/sabor/presentación. | Generalización ADEC+INNO |
| **PriceList / Price** | N listas de precios por tenant (P1–P20 INNOLATTE), resolución sin fallback silencioso ("sin precio = línea bloqueada"), overrides por documento con precio manual auditado. | INNOLATTE `producto_precios` |
| **RateCard** | Tarifa por recurso/actividad (por aeronave CAAA, por servicio-terapia Kinetic, por instructor). | CAAA `aeronave_tarifa` |
| **ChargeConcept** | Catálogo configurable de cargos puntuales ("Reposición de examen $60"). | CAAA `concepto_cobro` |
| **FeeRule** | Regla paramétrica de recargo: mora 5%/bloque-5-días (Kinetic), tarifa por tiempo 15min+$5/30min (late pickup Kinetic), multa por frecuencia 4-cancelaciones/mes=$35 (CAAA). Motor puro configurable. | Kinetic `lib/domain/billing` |

### 3.4 Trabajo, Agenda y Ejecución (MP3)

| Entidad | Definición | Ref. |
|---|---|---|
| **Resource** | Cualquier cosa agendable: persona-operador (terapista, instructor), activo (aeronave, vehículo, sala). Con horario de disponibilidad y **capacidad contratada** (semáforo de ocupación Kinetic). | Kinetic `therapist_work_schedule` + CAAA |
| **Booking** | Reserva de slot: cita, vuelo programado, evento multi-persona. **Motor de conflictos N-dimensional** (recurso+operador+solicitante, CAAA) + solapamientos/cierres/fase-terminal (Kinetic) + auto-agendamiento con límites por regla (CAAA alumno). Flujo borrador→publicado en lote (CAAA semanas). | Kinetic `appointments` + CAAA motor 3D |
| **CalendarClosure** | Cierres institucionales/suspensión de operaciones con cascada de cancelación y aviso. | Kinetic `institutional_calendar` + CAAA `estado_operaciones` |
| **WorkOrder** | Unidad de trabajo ejecutable con máquina de estados (P6): boleta TAS, vuelo CAAA, sesión Kinetic, requirement FM. Tipos y estados configurables por tenant. | TAS `reportes` + CAAA `vuelo` |
| **Execution / EvidenceItem** | Ejecución real (inicio/fin, personal en sitio con horas individuales, materiales) + evidencia tipada: fotos (checkin/evidencia/checkout), **firma digital SVG**, checklist obligatorio pre-cierre. | TAS + CAAA `checklist_postvuelo` |
| **Agreement** | Acuerdo recurrente: plan/retainer (FM), plan de tratamiento con patrón semanal (Kinetic), inscripción a curso (CAAA). Es lo que la Recurrencia (MP2) materializa en Bookings + Cycle cada período (WYSIWYG Kinetic: se crean exactamente las citas mostradas). | Kinetic `treatment_plans` + FM `plans` |
| **Absence / Replacement** | Inasistencia con garantía de reposición en ventana (30 días) y sugeridor de slots libres. | Kinetic `appointment_absences` |

### 3.5 Comercio (pedidos)

| Entidad | Definición | Ref. |
|---|---|---|
| **Order / OrderLine** | Pedido de venta con folio secuencial por tenant, snapshot de líneas (P2), herencia de defaults del Account con overrides por documento, recálculo server-side, impuestos. | INNOLATTE `pedidos` |
| **InboundEvent / ExceptionItem** | Ingesta multicanal raw-first (P5) + clasificación contra catálogo por SKU + bandeja de excepciones (P7) con reproceso manual y cron de respaldo. | ADEC (pipeline completo) |

### 3.6 Económico (MP2)

| Entidad | Definición | Ref. |
|---|---|---|
| **LedgerAccount / LedgerEntry** | Cuenta corriente por Account con saldo cacheado y movimientos inmutables tipados (DEPÓSITO/CARGO/AJUSTE/ANULACIÓN), edición con recálculo en cascada, anulación por contrapartida (P3). Unifica prepago CAAA y wallet de créditos FM. | CAAA `movimiento_cuenta` + FM `client_credits` |
| **Invoice / InvoiceLine / Quote** | Factura y cotización con numeración por tenant, snapshot fiscal, IVA/retención, DTE (localización SV → parametrizable), PDF, conversión cotización→factura. | FM/Kinetic `invoices`+`quotes` |
| **Cycle** | Ciclo de recurrencia con estado de pago, mora, gracia configurable, suspensión automática, renovación y rollover de unidades no consumidas. Cron diario. | FM `billing_cycles` + Kinetic `monthly_session_cycles` |
| **PaymentEvent / Payment** | Evento crudo de pasarela (auditoría + firma + idempotencia) → matching por prioridades (referencia→suscripción→email→huérfano) → aplicación. **Pasarela tras interfaz** (n1co hoy; Stripe/otros mañana). | FM (n1co completo) |
| **Expense** | Egresos con categorías configurables y generación automática desde otros módulos (consumo de repuestos, nómina pagada). | Kinetic `general_expenses` + CAAA `egreso` |

### 3.7 Personas internas / RRHH

| Entidad | Definición | Ref. |
|---|---|---|
| **WorkSession / TimeEntry** | Jornada (clock-in/out, breaks) + timers por entidad (fase, tarea, administrativo) con guard de timer único; timesheets y productividad online-vs-productivo. | FM/Kinetic (idéntico motor) |
| **PayrollRun / PayrollItem / FiscalConfig** | Nómina con dos regímenes (planta con ISSS/AFP/ISR por tramos + servicios profesionales con retención plana), config fiscal versionada por vigencia, **sellado inmutable con snapshot** (P2), firma digital del recibo, insumos externos por evento (horas voladas, pagos de teoría). **Diseño convergente Kinetic↔CAAA** — se toma Kinetic como referencia por integración con Egresos y recibos, validado por CAAA. | Kinetic `payroll_*` (+CAAA) |
| **Task** | Tarea asignada fuera de plan con timer integrado. | FM `assigned_tasks` |

### 3.8 Contenido, Documentos y Compliance

| Entidad | Definición | Ref. |
|---|---|---|
| **File / Attachment** | Archivos con buckets público/privado, URLs firmadas, compresión, ZIP con control de acceso, adjuntable a cualquier entidad. | FM/Kinetic |
| **ReviewableDocument / ReviewVersion / Annotation / ReviewComment** | El MP1 como entidad: cualquier documento con workflow de aprobación. El proofing visual (pines posicionales sobre imagen/video/PDF, hilos, versiones con gating de pines activos) es la variante rica. | FM `review_*` (proofing) + patrón genérico de TAS/Kinetic/CAAA |
| **RequiredDocumentCatalog / ComplianceDocument** | Catálogo configurable de documentos requeridos por tipo de Party/Account, estados (pendiente/entregado/vencido/rechazado), **alertas por vencimiento** (60 días CAAA; semáforo 30/60 TAS). Diseño convergente CAAA↔TAS. | CAAA `documento_*` |

### 3.9 Comunicación

| Entidad | Definición | Ref. |
|---|---|---|
| **Conversation / Message** | Conversación interna (DM/canal, menciones, adjuntos, reply, share-cards de entidades) **y** externa (canal WhatsApp con `wamid`, media, plantillas, ventana de 24h). Un solo modelo con `channel_type`. | FM (ambas, en producción) |
| **CallSession / Presence** | Llamadas voz/video/pantalla (LiveKit, agnóstico de host), ring/perdidas, presencia con estado+emoji. | FM/Kinetic |
| **Notification** | Feed in-app. Dos estrategias probadas: derivado sin tabla (FM) vs tabla persistente (CAAA/Kinetic). La plataforma adopta **tabla persistente con productores por evento** (más simple de extender multi-módulo). | Kinetic + CAAA |
| **NotificationDelivery** | Entrega transaccional multicanal (email/WhatsApp/SMS) con plantillas por tenant/marca, reintentos, idempotencia por índice único (P4), auditoría de intentos, multi-transporte con prioridad y modo prueba. Unifica los 3 motores de correo (ADEC/TAS/CAAA). | ADEC (reintentos+idempotencia) + TAS (multi-transporte) |

### 3.10 Workflow, Eventos y Automatización

| Entidad | Definición | Ref. |
|---|---|---|
| **Pipeline / Stage / StageTransition** | MP4 como entidad: fases configurables por tenant, transiciones con log, efectos declarativos por transición. Gobierna cualquier entidad (`target_type`+`target_id`). | FM+Kinetic (ya sirve 3 dominios) |
| **DomainEvent** | Evento de negocio tipado (`invoice.paid`, `workorder.approved`, `booking.completed`…) — el bus interno del que consumen automatizaciones, notificaciones, IA y webhooks salientes. Formaliza los `require()` cruzados actuales. | Diseño nuevo (catalogado en Doc 8) |
| **WebhookEndpoint / WebhookEventRaw** | Entrantes raw-first (P5) con firma HMAC por origen; salientes por suscripción del tenant. | ADEC (in) + CAAA `webhook_endpoint` (out, latente) |
| **Automation / Job** | Cola de trabajos en Postgres con claim atómico (`FOR UPDATE SKIP LOCKED`), reintentos con backoff exponencial, auditoría de eventos de job, y crons declarativos por tenant. | FM `ai_jobs` (generalizado a cualquier job) |
| **AuditEntry** | Log tipado actor/entidad/IP/diff antes-después, filtrable. | CAAA `auditoria_evento` + FM forense |

### 3.11 Activos, Proyectos y Logística

| Entidad | Definición | Ref. |
|---|---|---|
| **Asset / AssetComponent / MaintenanceTask / MaintenanceCompliance** | Activo físico con componentes, tareas programadas por horas/ciclos/fecha que "resetean el reloj" al cumplirse, y caché de próxima revisión hacia el activo (P10). | CAAA Taller |
| **InventoryItem / StockMovement** | Inventario ligero con kardex (entrada/salida/ajuste) y generación automática de Expense al consumir. | CAAA Taller |
| **Project / ProjectActivity / ProgressReport** | Proyecto con plazo en **días hábiles** y estados autocalculados (por_iniciar/en_progreso/en_riesgo/vencido/completado), actividades con % acumulado, reporte diario multi-actividad con evidencia y firma, aprobación con observaciones, avisos de ciclo de vida por cron, métricas de confiabilidad por Vendor. | TAS Subcontratos |
| **Route / RouteStop / GeoArea** | Horario de zonas (quincenal), hoja de ruta diaria cruzada con pedidos pendientes de entrega. GeoArea normaliza distritos/zonas (hoy texto libre — deuda INNOLATTE). | INNOLATTE `rutas` |
| **FleetVehicle / Trip** | Telemetría de flota tras interfaz `FleetProvider` (Geotab hoy): paradas >N min geocodificadas, ruta por WorkOrder vía placa. | TAS Geotab adapter |

### 3.12 Aprendizaje (LMS)

| Entidad | Definición | Ref. |
|---|---|---|
| **Course / CourseUnit / Material** | Curso → unidades → materiales, con requisitos de horas prácticas por **categoría de actividad** (generalización de "por tipo de aeronave"). | CAAA Aula Virtual |
| **Enrollment / EnrollmentProgress** | Matrícula con estado y avance de horas alimentado por eventos de WorkOrder completada (vía DomainEvent, no SQL cruzado). | CAAA |
| **Evaluation / EvaluationResult** | Evaluaciones con origen interno vs autoridad externa; aprobar el final dispara eventos (notificar, generar pago pendiente a Nómina). | CAAA |
| **ClassSession / Attendance** | Sesiones con lista precargada PRESENTE (solo se marcan excepciones). | CAAA |

### 3.13 Formularios e IA

| Entidad | Definición | Ref. |
|---|---|---|
| **FormDefinition / FormResponse** | Formularios configurables (checklists de 19 ítems, encuestas, wizards multi-paso con cálculo en vivo). Base también del extractor IA (el schema del formulario ES el contrato de extracción). | CAAA checklist/wizard + TAS |
| **Agent / AgentTool / AgentRun** | Agente IA por audiencia con system prompt, modelo, temperatura, `enabled_tools[]` editables en runtime; tool registry con scoping por tenant/Account; tracking de costos por corrida; handoff a humano. | FM `wa_bot_configs` + tools |
| **ExtractionSchema** | Definición de campos+vocabularios controlados para captura conversacional (narración→JSON con repreguntas). | TAS extractor |

---

## 4. Tabla de mapeo: entidad universal × 6 sistemas

La prueba empírica del 60–80%. (— = no existe; ~ = parcial)

| Entidad universal | FM | Kinetic | TAS | CAAA | ADEC | INNO |
|---|---|---|---|---|---|---|
| User (ancla) | `users` | `users` | `usuarios` | `usuario` | `profiles` | `perfiles` |
| ExternalIdentity | `client_users` | `family_users` | `subcontratos_usuarios` | (alumno=usuario) | ~preparado | — |
| Account | `clients` | `families` | `clientes` | `alumno`+`cuenta_corriente` | encargado (snapshot) | `clientes` |
| Contact | `client_whatsapp_contacts` | `family_members` | `persona_contacto` | — | — | contacto en cliente |
| Lead | `wa_leads` | `waitlist_entries` | oportunidades (`cotizacion_*`) | — | — | — |
| Vendor/VendorWorker | — | — | `subcontratos_empresas/tecnicos` | `medico_autorizado`~ | — | — |
| CatalogItem | `plans` | `service_catalog` | catálogo actividades | `concepto_cobro`+tarifas | `productos` | `productos` |
| PriceList/Price | — | precios en catálogo | — | `aeronave_tarifa` | precio por variante | `producto_precios` (20 listas) |
| FeeRule | mora en ciclos | late-fee + late-pickup | — | multa cancelaciones | — | — |
| Resource | — | terapistas+horarios | vehículos~ | `aeronave`+instructor | — | — |
| Booking | calendario | `appointments` | — | `solicitud_vuelo`/`vuelo` | — | — |
| WorkOrder | `requirements` | citas/sesiones | `reportes` (boletas) | `vuelo` | `ordenes`~ | `pedidos`~ |
| Execution/Evidence | — | `therapy_sessions` | fotos+firma+personal | checklist+`reporte_vuelo` | — | — |
| Agreement | plan/retainer | `treatment_plans` | — | `inscripcion_curso` | — | defaults de cliente~ |
| Order/OrderLine | — | — | — | — | `ordenes/orden_items` | `pedidos/pedido_items` |
| InboundEvent/Exception | `n1co_payment_events` | — | — | `webhook_evento`~ | `webhook_events`+revisión | — |
| LedgerAccount/Entry | `client_credits` | — | — | `movimiento_cuenta` | — | — |
| Invoice/Quote | `invoices/quotes` | `invoices/quotes` | — | `factura`+`recibo_pago` | — | — |
| Cycle | `billing_cycles` | `monthly_session_cycles` | — | — | — | — |
| PaymentEvent | n1co completo | n1co (heredado) | — | — | — | — |
| Expense | — | `general_expenses` | — | `egreso` | — | — |
| WorkSession/TimeEntry | `work_sessions/time_entries` | ídem | horas en boleta~ | horas de vuelo~ | — | — |
| PayrollRun/FiscalConfig | — | `payroll_*` | — | `nomina_*`+`config_fiscal` | — | — |
| Task | `assigned_tasks` | — | — | — | — | — |
| ReviewableDocument | `review_*` (proofing) | `session/progress_reports` | boletas+avances | `reporte_vuelo` | bandeja revisión | — |
| ComplianceDocument | — | `child_attachments`~ | exámenes/ISSS | `documento_alumno`+catálogo | — | — |
| Conversation/Message (int.) | `conversations/messages` | ídem | — | — | — | — |
| Conversation (ext./canal) | `wa_conversations/wa_messages` | — | — | — | — | — |
| CallSession/Presence | LiveKit+`user_presence` | ídem | — | — | — | — |
| Notification (in-app) | feed derivado | feed+`dashboard_alerts` | badges/counts | `notificacion` | — | — |
| NotificationDelivery | plantillas WA | — | 14+6 correos, 3 transportes | SMTP | reintentos+idempotencia | — |
| Pipeline/Stage | 12 fases+logs | intake 17 subfases | comercial | semanas borrador→publicado | — | estados pedido~ |
| Job/Automation | `ai_jobs` (cola) | Edge cron | crons de avisos | pg_cron ×3 | cron reproceso | keepalive |
| AuditEntry | `impersonation_logs`+forense | fases/planillas | edición+tiempos | `auditoria_evento` (diff) | `webhook_events` | — |
| Asset/Maintenance | — | — | — | Taller completo | — | — |
| Inventory/Kardex | — | — | — | `taller_repuesto`+mov. | — | — |
| Project/ProgressReport | — | — | Subcontratos completo | — | — | — |
| Route/GeoArea | — | — | — | — | — | `rutas`+distritos |
| FleetVehicle/Trip | — | — | Geotab | — | — | — |
| Course/Enrollment/Eval | — | — | — | Aula Virtual completa | — | — |
| FormDefinition | — | — | schema del bot | checklist+wizard W&B | — | — |
| Agent/AgentTool | 18 tools+configs | infra heredada | extractor+2 chats | — | — | — |

**Conteo:** de 40 entidades universales, 31 tienen al menos una implementación en producción, 19 tienen dos o más (convergencia independiente), y solo Tenant + DomainEvent son diseño puro. La hipótesis del 60–80% queda validada: el producto ya existe, repartido en seis bases de datos.

---

## 5. Qué se redefine, fusiona o desaparece

| Decisión | Detalle |
|---|---|
| **Fusionar** clients/families/alumnos/clientes → `Account` sobre `Party` | El renombrado por vertical es presentación (labels por vertical pack), no modelo. |
| **Fusionar** los 3 motores de correo + plantillas WA → `NotificationDelivery` | Un servicio, N transportes tras interfaz, plantillas por tenant/Unit. |
| **Fusionar** `client_credits` + `cuenta_corriente` → `Ledger` | El wallet FM es un caso particular del ledger CAAA. |
| **Fusionar** calendario FM + agenda Kinetic + programación CAAA → `Booking` sobre `Resource` | El motor de conflictos 3D de CAAA es el superconjunto. |
| **Fusionar** waitlist Kinetic + kanban FM + comercial TAS → un solo motor `Pipeline` | Ya probado: Kinetic corre dos pipelines de dominios distintos con el mismo patrón. |
| **Redefinir** boleta/vuelo/sesión/requirement → `WorkOrder` con tipos+estados configurables | La máquina de estados pasa de CHECK constraints a configuración por tenant. |
| **Redefinir** dimensiones fijas (colegio/sede/grado, CD/etiqueta, categoría/familia/sabor) → `Dimension` configurable | Condición necesaria para que Catálogo, Pedidos y Reportería sean horizontales. |
| **Desaparecer** tablas legacy (TAS `tecnicos`/`dashboard_usuarios`, CAAA mantenimiento legado como API paralela) | Se migran, no se portan. |
| **Desaparecer** auth heterogénea (JWT custom CAAA, password_hash en texto plano TAS) | Identidad única de plataforma; hallazgo de seguridad TAS se corrige por sustitución. |
| **Permanece vertical** (no generalizar) | Peso y Balance (CAAA), normalizadores WooCommerce específicos (ADEC), despacho de niños (Kinetic), decodificador METAR. Viven en vertical packs. |

---

## 6. Dimensiones configurables — la generalización clave

El error repetido en 4 sistemas fue cablear los ejes de clasificación como columnas. El modelo unificado los trata como datos:

```
dimension            (tenant_id, key, label, applies_to[])     ej. "sede", "grado", "canal", "zona"
dimension_value      (dimension_id, slug, label, parent_id, orden)
entity_dimension     (entity_type, entity_id, dimension_value_id)
```

Con esto: el Catálogo ADEC (colegio/sede/grado/talla), el cliente INNOLATTE (canal/CD/etiqueta/distrito), la reportería "por dimensiones" y los filtros de listados se vuelven el mismo mecanismo. La Reportería Operativa deja de estar acoplada a tres tipos de artículo y pasa a agregar por cualquier eje que el tenant defina.

---

## 7. Máquinas de estado como configuración

Los 6 sistemas suman ~15 máquinas de estado en CHECK constraints. En la plataforma:

```
state_machine        (tenant_id?, entity_type, key)            con plantillas de fábrica por vertical
state                (machine_id, key, label, category, is_terminal, orden)
transition           (machine_id, from_state, to_state, guard?, effects[])
state_log            (entity_type, entity_id, from, to, actor, at, metadata)
```

Los `effects[]` declarativos (crear registro, cargar a ledger, notificar, cancelar dependencias, emitir DomainEvent) reemplazan los `require()` cruzados entre controladores — y resuelven de raíz el bug de diseño de CAAA (dos caminos a COMPLETADO donde solo uno cobra): el cobro es un efecto de la transición, no de un controlador particular.

---

*Siguiente documento de la serie: DOC6 — Catálogo Unificado de Módulos (reconciliación de las 59 propuestas).*
