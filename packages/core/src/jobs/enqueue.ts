// Encolado de trabajos (DOC3 §3). Idempotencia por dedupe_key: el índice
// único parcial (tenant_id, kind, dedupe_key) convierte el duplicado en un
// éxito silencioso (CLAUDE.md regla 11).
import type { Json } from "@plataforma/db";

import type { DbClient } from "../db-client";

export interface EnqueueJobInput {
  tenantId: string;
  kind: string;
  payload?: Json;
  /** Instante a partir del cual el job es elegible (default: ya). */
  scheduledFor?: Date;
  /** Clave de idempotencia; kinds periódicos incluyen el período (billing:2026-07). */
  dedupeKey?: string;
  maxAttempts?: number;
}

export type EnqueueResult =
  | { id: string; deduplicated: false }
  | { id: null; deduplicated: true };

const UNIQUE_VIOLATION = "23505";

export async function enqueueJob(
  supabase: DbClient,
  input: EnqueueJobInput,
): Promise<EnqueueResult> {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      tenant_id: input.tenantId,
      kind: input.kind,
      payload: input.payload ?? {},
      scheduled_for: (input.scheduledFor ?? new Date()).toISOString(),
      dedupe_key: input.dedupeKey ?? null,
      ...(input.maxAttempts ? { max_attempts: input.maxAttempts } : {}),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION && input.dedupeKey) {
      return { id: null, deduplicated: true };
    }
    throw new Error(`No se pudo encolar ${input.kind}: ${error.message}`);
  }
  return { id: data.id, deduplicated: false };
}
