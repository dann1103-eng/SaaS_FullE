# DOCUMENTO 8 — Event-Driven Architecture
### Catálogo de eventos de negocio
*Iteración 3. Convención: `modulo.entidad.accion` en pasado. El outbox transaccional y el despachador están definidos en DOC3 §3. Este catálogo reemplaza TODOS los acoplamientos directos detectados en los donantes (imports cruzados, SQL a tablas ajenas).*

---

## 1. Anatomía de un evento

```ts
{
  id: uuid, tenant_id: uuid,
  event_key: "m07.payment.received",
  entity: { type: "invoice", id: uuid },
  payload: { /* zod schema versionado por event_key */ },
  actor: { kind: "user"|"agent"|"system"|"external", id? },
  occurred_at, version: 1
}
```
Reglas: payload autosuficiente (el consumidor no re-consulta para lo básico) · emisión en la misma transacción del cambio (outbox) · consumidores idempotentes (re-entrega posible) · versionado por `event_key`.

## 2. Catálogo por dominio

### Core
| Evento | Productor | Consumidores principales |
|---|---|---|
| core.tenant.created | registro | seeds, onboarding, billing de plataforma |
| core.module.activated / deactivated | C2 | navegación, seeds de plantillas, plataforma-billing |
| core.user.created / role_changed | C1 | C5 (bienvenida), C7 |
| core.impersonation.started / ended | C1 | C7 |
| core.file.uploaded | C6 | antivirus/procesado futuro |
| core.job.failed_final | C4 | C5 (alerta a admin del tenant) |
| core.inbound_event.received / failed | C4 | módulo dueño de la fuente, bandeja de excepciones |

### M01 CRM
| Evento | Consumidores |
|---|---|
| m01.account.created | C5 (aviso interno — patrón "nuevo cliente" TAS), M19 (provisión), M18 |
| m01.account.updated / suspended / reactivated | M19, M08 (gate), M17 |
| m01.account.merged | todos los que referencien account_id |
| m01.contact.created / updated | M17 (matching por teléfono) |
| m01.lead.created / escalated / converted | M10, C5, M18 (handoff) |

### M02 Catálogo
`m02.item.created/updated/archived` → M03 (re-clasificación de excepciones pendientes: cierra el loop ADEC "corrijo catálogo→reproceso") · `m02.price.changed` → M03 (armador en vivo), C7 · `m02.feerule.changed` → M08/M09.

### M03 Pedidos
| Evento | Consumidores |
|---|---|
| m03.order.received (ingesta) | clasificador |
| m03.order.classified | C5 (confirmación al comprador), M25, M23 |
| m03.order.needs_review | bandeja excepciones, C5 (alerta interna) |
| m03.order.reprocessed | C5 (si pasó a classified) |
| m03.order.status_changed (pendiente→en_ruta→entregado/cancelado) | M23, M25 |
| m03.order.invoiced_flagged | M06 (si activo: emitir) |

### M04 Field Service
| Evento | Consumidores |
|---|---|
| m04.workorder.created | M11 (cola de revisión), C5 (aviso supervisor/asistente) |
| m04.workorder.started / completed | M22 (horas del activo), M09 (cargo), M20 (pago por servicio), M26 (avance práctico), M25 |
| m04.workorder.no_show | M09 (no cobra — regla CAAA), M05 |
| m04.workorder.opportunity_flagged | M10 (pipeline comercial), C5 (correo a ventas — patrón TAS) |
| m04.evidence.signed | C7 |

### M05 Agenda
| Evento | Consumidores |
|---|---|
| m05.booking.created / moved / reassigned / cancelled | C5 (avisos), M25 |
| m05.booking.completed | **M09 (cargo automático por tarifa — corrige el bug CAAA por diseño)**, M26, M20 |
| m05.schedule.published | C5 (notifica afectados), crea semana siguiente |
| m05.closure.declared (suspensión operativa) | cascada de cancelación + C5 (patrón Turno CAAA) |
| m05.absence.registered / replaced / waived | M08 (rollover), C5 |
| m05.capacity.threshold_reached | C5 (alerta ocupación >85% — semáforo Kinetic) |

### M06 Facturación
`m06.invoice.issued` → C5 (envío), M07 (link), M19 · `m06.invoice.paid` → M08 (ciclo), M09 (extras→créditos), M25 · `m06.invoice.voided` → M09 (refund — patrón FM), C7 · `m06.quote.accepted` → M06 (conversión) · `m06.receipt.issued` (depósito) → M09.

### M07 Pagos
| Evento | Consumidores |
|---|---|
| m07.payment_event.received (raw) | matcher |
| m07.payment.matched → m06.invoice.paid | (cadena) |
| m07.payment.orphaned | bandeja excepciones, C5 (alerta admin) |
| m07.payment.link_generated / expired | M19, M18 (tool send_payment_link) |

### M08 Recurrencia
| Evento | Consumidores |
|---|---|
| m08.cycle.generated (+factura) | M05 (bookings WYSIWYG del ciclo), C5 |
| m08.cycle.due_soon / overdue | C5 (dunning), M18 (recordatorio por bot) |
| m08.grace.granted / expired | M19 (gate), C5 |
| m08.account.suspended_nonpayment / reactivated | M01, M19, M05 (bloquear agenda), C5 |
| m08.cycle.renewed / rolled_over | M25 |

### M09 Ledger
`m09.entry.charged / deposited / adjusted / voided` → M25, C7 · `m09.balance.below_threshold` → C5 (morosos CAAA), M18 · `m09.credit.consumed / refunded` → M19.

### M10 Pipelines
`m10.stage.changed` → efectos declarativos (crear registro, notificar, cancelar dependencias — patrón intake Kinetic "inscribir crea familia+niño") · `m10.item.stalled` (>N días — alerta Kinetic) → C5 · `m10.pipeline.completed` → módulo dueño.

### M11 Revisión
| Evento | Consumidores |
|---|---|
| m11.document.submitted | C5 (cola del revisor) |
| m11.document.approved | productor del documento (boleta→procesamiento admin; informe→enviable a familia; avance→% proyecto), C5 al afectado |
| m11.document.rejected / needs_data | responsable asignado (circuito #SAP generalizado), C5 |
| m11.document.edited_by_reviewer | C5 (aviso al autor/cliente — patrón TAS) |
| m11.review.pin_added / resolved · m11.version.uploaded | M19, C5 (menciones) |

### M12 Compliance
`m12.document.uploaded / status_changed` → C7 · `m12.document.expiring(days:60|30)` / `expired` → C5, M13 (bloquear asignación de worker con examen vencido — semáforo TAS).

### M13 Proyectos
`m13.project.assigned` → C5 (correo a vendor) · `m13.progress.reported` → M11 · `m13.progress.approved/rejected` → % proyecto, C5 (correo a empresa) · `m13.project.at_risk(80%) / overdue / completed / inactive(Nd)` → C5 (los 6 avisos TAS), M25.

### M14–M16
`m14.shift.started/ended` · `m14.timer.started/stopped` → M25, M10 (tiempo por fase) · `m15.task.assigned/completed` → C5 · `m16.message.sent / mention.created / call.missed` → C5.

### M17 Omnicanal / M18 Agentes
| Evento | Consumidores |
|---|---|
| m17.conversation.inbound | M18 (maybeEnqueueReply con debounce), C5 (si needs_attention) |
| m17.conversation.needs_attention (handoff) | C5, inbox destacado |
| m17.template.sent / failed | C7 |
| m18.agent.run_completed (con costo) | metering C9, M25 |
| m18.agent.tool_executed | C7 (toda acción del bot es auditable) |
| m18.extraction.completed | módulo destino (M04 crea WorkOrder desde narración) |

### M19 Portal
`m19.request.created` (contenido/cita/cambio) → módulo destino + C5 · `m19.approval.given` → M11 · `m19.purchase.initiated` → M06/M07.

### M20–M26
`m20.payroll.approved (sellado) / paid` → M21 (egreso automático), C5 (recibos) · `m20.payslip.signed` → C7 · `m21.expense.recorded` → M25 · `m22.maintenance.due_soon / complied` → C5, M05 (disponibilidad del recurso) · `m22.asset.blocked/unblocked` → M05 (cancela/reasigna — flujo CAAA) · `m22.stock.consumed` → M21 · `m23.route_sheet.generated` → M25 · `m24.trip.matched_workorder` → M04 · `m26.evaluation.passed(final)` → C5 (notifica dirección+instructor), M20 (pago de teoría), M10 (avanza fase — cadena CAAA completa) · `m26.enrollment.hours_completed` → elegibilidad (extracurriculares CAAA).

## 3. Cadenas de referencia (sanity checks del diseño)

**Venta recurrente completa (FM/Kinetic):**
`m08.cycle.generated → m06.invoice.issued → m07.payment.link_generated → [cliente paga] → m07.payment_event.received → m07.payment.matched → m06.invoice.paid → m08.cycle.(paid) → m05 genera bookings → ... → m05.booking.completed → m09.entry.charged`

**Boleta de campo (TAS):**
`m18.extraction.completed → m04.workorder.created → m11.document.submitted → [supervisor aprueba] → m11.document.approved → C5 correo cliente+encuesta ∥ m04.opportunity_flagged → m10 pipeline comercial → métricas`

**Vuelo (CAAA, corregido):**
`m05.booking.completed → m09.entry.charged ∥ m22 horas del activo ∥ m26 avance práctico ∥ m20 horas del instructor` — cuatro consecuencias, cero imports cruzados.

**Pedido e-commerce (ADEC):**
`core.inbound_event.received → m03.order.received → classified|needs_review → C5 confirmación|alerta → [corrige catálogo] → m02.item.created → reproceso automático de excepciones`

## 4. Total: ~95 eventos v1. Cada manifest declara `produces[]` y `consumes[]`; CI valida que nadie consuma un evento no declarado y que no existan imports entre `packages/modules/*`.
