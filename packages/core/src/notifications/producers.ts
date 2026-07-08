// Productores de notificaciones por evento (DOC3 §4 / DOC8).
// Primer consumidor real del bus: core.job.failed_final → alerta a los
// admins del tenant (feed + email). Idempotente por diseño: el feed tolera
// duplicados benignos y el delivery está anclado por entity_ref (ADR-001).
import type { DbClient, DomainEventRow } from "../db-client";
import { hasPermission } from "../auth/permissions";
import { createDelivery, createNotification } from "./deliver";

const ADMIN_PERMISSION = "core.tenant.manage";

interface AdminRecipient {
  userId: string;
  email: string | null;
}

/** Miembros activos cuyo rol cubre core.tenant.manage (owner '*' incluido). */
export async function fetchTenantAdmins(
  admin: DbClient,
  tenantId: string,
): Promise<AdminRecipient[]> {
  const { data, error } = await admin
    .from("memberships")
    .select("user_id, user:users(email), role:roles(role_permissions(permission_key))")
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  if (error) throw new Error(`No se pudieron leer los admins del tenant: ${error.message}`);

  return (data ?? [])
    .filter((m) => {
      const grants = m.role?.role_permissions.map((p) => p.permission_key) ?? [];
      return hasPermission(grants, ADMIN_PERMISSION);
    })
    .map((m) => ({ userId: m.user_id, email: m.user?.email ?? null }));
}

export async function jobFailedFinalProducer(ctx: {
  event: DomainEventRow;
  supabase: DbClient;
}): Promise<void> {
  const { event, supabase } = ctx;
  const payload = (event.payload ?? {}) as { kind?: string; error?: string };
  const jobKind = payload.kind ?? "desconocido";
  const errorText = payload.error ?? "sin detalle";

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", event.tenant_id)
    .single();
  const tenantName = tenant?.name ?? event.tenant_id;

  const admins = await fetchTenantAdmins(supabase, event.tenant_id);

  for (const adminUser of admins) {
    await createNotification(supabase, {
      tenantId: event.tenant_id,
      userId: adminUser.userId,
      type: "core.job_failed",
      title: `Trabajo fallido: ${jobKind}`,
      body: `El trabajo agotó sus reintentos. Último error: ${errorText}`,
    });

    if (adminUser.email) {
      await createDelivery(supabase, {
        tenantId: event.tenant_id,
        channel: "email",
        templateKey: "core.job_failed",
        recipient: adminUser.email,
        entityRef: `job:${event.entity_id ?? event.id}`,
        variables: { tenantName, jobKind, error: errorText },
      });
    }
  }
}
