// Despachador del outbox: entrega eventos no procesados a los suscriptores
// declarativos (los manifests de módulos se registran aquí — DOC3 §3).
// Un solo runner por tick (cron); los consumidores toleran re-entrega.
import type { DbClient, DomainEventRow } from "../db-client";
import { assertValidEventKey } from "./event-key";

export type DomainEventHandler = (ctx: {
  event: DomainEventRow;
  supabase: DbClient;
}) => Promise<void>;

export class EventSubscriptions {
  private readonly handlers = new Map<string, DomainEventHandler[]>();

  /** Suscripción declarativa: on('m07.payment.received', handler). */
  on(eventKey: string, handler: DomainEventHandler): void {
    assertValidEventKey(eventKey);
    const list = this.handlers.get(eventKey) ?? [];
    list.push(handler);
    this.handlers.set(eventKey, list);
  }

  handlersFor(eventKey: string): DomainEventHandler[] {
    return this.handlers.get(eventKey) ?? [];
  }
}

export interface DispatchResult {
  processed: number;
  delivered: number;
  failed: number;
  deadLettered: number;
}

const DEFAULT_LIMIT = 50;
const MAX_EVENT_ATTEMPTS = 5;

/**
 * Procesa eventos pendientes (processed_at is null) en orden de ocurrencia.
 * Sin suscriptores ⇒ se marca procesado (DOC7 §4: si nadie consume, no pasa
 * nada — cero condicionales cruzados). Errores ⇒ reintento en el próximo tick
 * hasta MAX_EVENT_ATTEMPTS; después queda dead-letter (processed_at con
 * last_error) para inspección manual.
 */
export async function dispatchDomainEventsTick(
  admin: DbClient,
  subscriptions: EventSubscriptions,
  options: { limit?: number } = {},
): Promise<DispatchResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const result: DispatchResult = { processed: 0, delivered: 0, failed: 0, deadLettered: 0 };

  const { data: events, error } = await admin
    .from("domain_events")
    .select("*")
    .is("processed_at", null)
    .order("occurred_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Despachador: no se pudo leer el outbox: ${error.message}`);

  for (const event of events ?? []) {
    const handlers = subscriptions.handlersFor(event.event_key);
    try {
      for (const handler of handlers) {
        await handler({ event, supabase: admin });
      }
      await admin
        .from("domain_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", event.id);
      result.processed += 1;
      result.delivered += handlers.length;
    } catch (err) {
      const attempts = event.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      const deadLetter = attempts >= MAX_EVENT_ATTEMPTS;
      await admin
        .from("domain_events")
        .update({
          attempts,
          last_error: message,
          ...(deadLetter ? { processed_at: new Date().toISOString() } : {}),
        })
        .eq("id", event.id);
      result.failed += 1;
      if (deadLetter) result.deadLettered += 1;
    }
  }

  return result;
}
