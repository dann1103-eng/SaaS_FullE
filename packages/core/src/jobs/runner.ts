// Runner de la cola (DOC3 §3): claim atómico vía RPC (FOR UPDATE SKIP LOCKED),
// ejecución por kind y transiciones succeeded/failed con backoff exponencial.
// Corre con service_role (bypass RLS) — solo desde /api/cron/tick o triggers
// fire-and-forget del servidor; jamás desde contexto de usuario.
import type { Json } from "@plataforma/db";

import type { DbClient, JobRow } from "../db-client";
import { emitDomainEvent } from "../events/emit";
import { retryDelaySeconds } from "./backoff";

export type JobHandler = (ctx: {
  job: JobRow;
  supabase: DbClient;
}) => Promise<Json | undefined>;

export class JobHandlerRegistry {
  private readonly handlers = new Map<string, JobHandler>();

  register(kind: string, handler: JobHandler): void {
    if (this.handlers.has(kind)) {
      throw new Error(`Handler duplicado para el kind "${kind}"`);
    }
    this.handlers.set(kind, handler);
  }

  get(kind: string): JobHandler | undefined {
    return this.handlers.get(kind);
  }
}

export interface JobsTickResult {
  claimed: number;
  succeeded: number;
  rescheduled: number;
  failedFinal: number;
}

async function logJobEvent(
  admin: DbClient,
  jobId: string,
  type: "claimed" | "succeeded" | "failed" | "rescheduled",
  detail: Json = {},
): Promise<void> {
  await admin.from("job_events").insert({ job_id: jobId, type, detail });
}

export async function runJobsTick(
  admin: DbClient,
  registry: JobHandlerRegistry,
  options: { limit?: number } = {},
): Promise<JobsTickResult> {
  const result: JobsTickResult = { claimed: 0, succeeded: 0, rescheduled: 0, failedFinal: 0 };

  const { data: jobs, error } = await admin.rpc("claim_jobs", {
    p_limit: options.limit ?? 10,
  });
  if (error) throw new Error(`claim_jobs falló: ${error.message}`);

  for (const job of jobs ?? []) {
    result.claimed += 1;
    await logJobEvent(admin, job.id, "claimed", { attempt: job.attempts });

    const handler = registry.get(job.kind);
    if (!handler) {
      // Error de configuración, no transitorio: no se reintenta.
      await failJob(admin, job, `handler no registrado para kind "${job.kind}"`, result);
      continue;
    }

    try {
      const output = await handler({ job, supabase: admin });
      await admin
        .from("jobs")
        .update({ status: "succeeded", last_error: null })
        .eq("id", job.id);
      await logJobEvent(admin, job.id, "succeeded", output ?? {});
      result.succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (job.attempts >= job.max_attempts) {
        await failJob(admin, job, message, result);
      } else {
        const delay = retryDelaySeconds(job.attempts);
        const nextRun = new Date(Date.now() + delay * 1000).toISOString();
        await admin
          .from("jobs")
          .update({ status: "pending", scheduled_for: nextRun, last_error: message })
          .eq("id", job.id);
        await logJobEvent(admin, job.id, "rescheduled", {
          attempt: job.attempts,
          delay_seconds: delay,
          error: message,
        });
        result.rescheduled += 1;
      }
    }
  }

  return result;
}

async function failJob(
  admin: DbClient,
  job: JobRow,
  message: string,
  result: JobsTickResult,
): Promise<void> {
  await admin.from("jobs").update({ status: "failed", last_error: message }).eq("id", job.id);
  await logJobEvent(admin, job.id, "failed", { attempt: job.attempts, error: message });
  result.failedFinal += 1;
  // DOC8: core.job.failed_final → C5 alerta al admin del tenant (Sesión 4).
  await emitDomainEvent(admin, {
    tenantId: job.tenant_id,
    eventKey: "core.job.failed_final",
    entityType: "job",
    entityId: job.id,
    actorKind: "system",
    payload: { kind: job.kind, error: message },
  });
}
