// C5: feed in-app + entregas transaccionales (DOC3 §4, ADR-001).
// Flujo de deliveries: RESERVAR (insert; 23505 = ya existe, éxito silencioso)
// → el tick ENVÍA → marca sent/failed. Reintentos reutilizan la fila.
import type { Json } from "@plataforma/db";

import type { DbClient } from "../db-client";
import { retryDelaySeconds } from "../jobs/backoff";
import { renderTemplate } from "./templates";
import { applyTestMode } from "./test-mode";
import type { EmailTransport } from "./transport";

const UNIQUE_VIOLATION = "23505";

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/** Crea una entrada del feed in-app (productores por evento; corre el runner). */
export async function createNotification(
  supabase: DbClient,
  input: CreateNotificationInput,
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
  if (error) throw new Error(`No se pudo crear la notificación: ${error.message}`);
}

export interface CreateDeliveryInput {
  tenantId: string;
  channel: "email";
  templateKey: string;
  recipient: string;
  /** Ancla de idempotencia: 'entidad:uuid' (+ ':período' si es repetible). */
  entityRef: string;
  variables?: Record<string, string>;
}

export type CreateDeliveryResult =
  | { id: string; deduplicated: false }
  | { id: null; deduplicated: true };

/** Reserva la entrega (ADR-001). El duplicado exacto es un éxito silencioso. */
export async function createDelivery(
  supabase: DbClient,
  input: CreateDeliveryInput,
): Promise<CreateDeliveryResult> {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .insert({
      tenant_id: input.tenantId,
      channel: input.channel,
      template_key: input.templateKey,
      recipient: input.recipient,
      entity_ref: input.entityRef,
      variables: (input.variables ?? {}) as Json,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { id: null, deduplicated: true };
    throw new Error(`No se pudo reservar la entrega: ${error.message}`);
  }
  return { id: data.id, deduplicated: false };
}

export interface DeliveriesTickConfig {
  transport: EmailTransport | null;
  fromAddress: string;
  /** TEST_MODE global (env); el flag por tenant vive en tenants.settings. */
  globalTestMode: boolean;
  testRedirectTo: string;
  limit?: number;
}

export interface DeliveriesTickResult {
  processed: number;
  sent: number;
  rescheduled: number;
  failedFinal: number;
  skippedNoTransport: number;
}

interface TenantNotificationSettings {
  test_mode?: boolean;
  test_email?: string;
}

/**
 * Procesa entregas pendientes vencidas. Un solo runner por tick (cron);
 * TEST_MODE por tenant (settings.notifications) o global (env) redirige con
 * banner (patrón TAS).
 */
export async function processDeliveriesTick(
  admin: DbClient,
  config: DeliveriesTickConfig,
): Promise<DeliveriesTickResult> {
  const result: DeliveriesTickResult = {
    processed: 0,
    sent: 0,
    rescheduled: 0,
    failedFinal: 0,
    skippedNoTransport: 0,
  };

  // Elegibilidad con el reloj de la BD (migración 0005): comparar
  // next_attempt_at con el reloj del app server perdía filas por milisegundos.
  const { data: deliveries, error } = await admin.rpc("claim_deliveries", {
    p_limit: config.limit ?? 25,
  });
  if (error) throw new Error(`No se pudieron leer las entregas: ${error.message}`);

  const tenantIds = [...new Set((deliveries ?? []).map((d) => d.tenant_id))];
  const settingsByTenant = new Map<string, unknown>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await admin
      .from("tenants")
      .select("id, settings")
      .in("id", tenantIds);
    for (const t of tenants ?? []) settingsByTenant.set(t.id, t.settings);
  }

  for (const delivery of deliveries ?? []) {
    if (delivery.channel !== "email") continue; // otros canales llegan con M17

    if (!config.transport) {
      result.skippedNoTransport += 1;
      continue; // sin transporte configurado: quedan pendientes, sin quemar intentos
    }

    result.processed += 1;
    const attempts = delivery.attempts + 1;
    const settings = ((settingsByTenant.get(delivery.tenant_id) as
      | Record<string, unknown>
      | undefined)?.["notifications"] ?? {}) as TenantNotificationSettings;
    const testMode = config.globalTestMode || settings.test_mode === true;

    try {
      const rendered = renderTemplate(
        delivery.template_key,
        (delivery.variables ?? {}) as Record<string, string>,
      );
      const email = applyTestMode(
        { to: delivery.recipient, subject: rendered.subject, html: rendered.html },
        {
          enabled: testMode,
          redirectTo: settings.test_email ?? config.testRedirectTo,
          label: `${delivery.recipient} (${delivery.template_key} · ${delivery.entity_ref})`,
        },
      );
      const { providerId } = await config.transport.send(config.fromAddress, email);

      await admin
        .from("notification_deliveries")
        .update({
          status: "sent",
          attempts,
          provider_id: providerId,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", delivery.id);
      result.sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempts >= delivery.max_attempts) {
        await admin
          .from("notification_deliveries")
          .update({ status: "failed", attempts, last_error: message })
          .eq("id", delivery.id);
        result.failedFinal += 1;
      } else {
        const delay = retryDelaySeconds(attempts);
        await admin
          .from("notification_deliveries")
          .update({
            attempts,
            last_error: message,
            next_attempt_at: new Date(Date.now() + delay * 1000).toISOString(),
          })
          .eq("id", delivery.id);
        result.rescheduled += 1;
      }
    }
  }

  return result;
}
