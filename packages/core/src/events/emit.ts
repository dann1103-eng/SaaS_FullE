// Emisión de eventos de negocio al outbox (DOC3 §3, catálogo DOC8).
// Desde server actions: llamar tras el cambio de negocio (re-entrega posible;
// los consumidores son idempotentes por contrato). Para atomicidad estricta
// dentro de RPCs/triggers usar app.emit_domain_event en la misma transacción.
import type { Json } from "@plataforma/db";

import type { DbClient } from "../db-client";
import { assertValidEventKey } from "./event-key";

export interface DomainEventInput {
  tenantId: string;
  eventKey: string;
  entityType: string;
  entityId?: string | null;
  payload?: Json;
  actorKind?: "user" | "agent" | "system" | "external";
  actorId?: string | null;
}

export async function emitDomainEvent(
  supabase: DbClient,
  input: DomainEventInput,
): Promise<string> {
  assertValidEventKey(input.eventKey);
  const { data, error } = await supabase
    .from("domain_events")
    .insert({
      tenant_id: input.tenantId,
      event_key: input.eventKey,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      payload: input.payload ?? {},
      actor_kind: input.actorKind ?? "user",
      actor_id: input.actorId ?? null,
    })
    .select("id")
    .single();
  if (error) {
    throw new Error(`No se pudo emitir ${input.eventKey}: ${error.message}`);
  }
  return data.id;
}
