# ADR-001 — Índice de idempotencia TOTAL en notification_deliveries

**Fecha:** 2026-07-08 · **Estado:** aceptado · **Sesión:** 4 (C5 Notificaciones)

## Contexto

DOC3 §4 especifica el anti-duplicado de entregas como **índice único parcial**
`(entity_ref, recipient, template_key) where status='sent'`, siguiendo el
patrón del donante ADEC (`uq_correos_enviados_orden_dest ... where estado='enviado'`).

La cosecha del donante (Sesión 4) reveló que ese diseño tiene una ventana
TOCTOU **admitida por el propio donante** en su migración de robustez: su
flujo es *check → enviar → insertar*, así que dos ejecuciones concurrentes
envían dos correos y el índice solo hace fallar el segundo INSERT (error
tragado). El índice parcial protege contra filas duplicadas, no contra envíos
duplicados, y además permite acumular duplicados en estado `pending`.

## Decisión

1. Índice único **TOTAL** (sin cláusula `where`):
   `unique (tenant_id, channel, template_key, recipient, entity_ref)`.
2. Flujo **reservar → enviar → marcar**: el productor INSERTa la fila
   (reserva la clave; un duplicado es un 23505 = éxito silencioso, mismo
   patrón que jobs.dedupe_key), y el runner del tick es el único que envía y
   transiciona `pending → sent | failed`.
3. Los reintentos **reutilizan la fila** (attempts + next_attempt_at), nunca
   insertan otra.
4. Las notificaciones legítimamente repetibles codifican el período o el
   motivo en `entity_ref` (p. ej. `cycle:UUID:2026-08`), igual que
   `jobs.dedupe_key`.

## Consecuencias

- Idempotencia dura a nivel BD en todo el ciclo de vida (pending incluido),
  no solo tras el envío. Cero ventana de carrera entre productores.
- Un delivery `failed` definitivo bloquea la re-emisión automática de la
  misma clave; el reenvío manual es resetear la fila a `pending` (decisión
  operativa explícita, no un accidente).
- DOC3 §4 queda actualizado para referenciar este ADR.
