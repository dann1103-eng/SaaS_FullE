import { fetchGrants } from "@plataforma/core";

import { requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const { supabase, user, tenantId } = await requireAuth();

  if (!tenantId) {
    return (
      <section className="mx-auto max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold">Sin organización activa</h1>
        <p className="mt-2 text-sm">
          Tu usuario no tiene una membresía activa con tenant seleccionado. El
          registro self-service de organizaciones llega en la Sesión 6; por
          ahora pide a un administrador que te invite.
        </p>
      </section>
    );
  }

  // RLS en acción: esta consulta solo puede devolver el tenant del claim.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, plan, status, settings")
    .eq("id", tenantId)
    .single();

  const grants = await fetchGrants(supabase, user.id, tenantId);
  const settings = (tenant?.settings ?? {}) as Record<string, unknown>;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 data-testid="tenant-name" className="text-2xl font-semibold">
          {tenant?.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          slug <code>{tenant?.slug}</code> · plan {tenant?.plan} · estado {tenant?.status}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-500">Configuración del tenant</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Zona horaria</dt>
              <dd data-testid="tenant-tz">{String(settings["timezone"] ?? "—")}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Moneda</dt>
              <dd>{String(settings["currency"] ?? "—")}</dd>
            </div>
            <div className="flex justify-between">
              <dt>IVA</dt>
              <dd>{String(settings["tax_rate"] ?? "—")}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-500">
            Permisos de tu rol (vía memberships → roles)
          </h2>
          <ul data-testid="grants" className="mt-2 space-y-1 text-sm">
            {grants.length === 0 && <li className="text-neutral-400">— sin permisos —</li>}
            {grants.map((g) => (
              <li key={g}>
                <code>{g}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-neutral-400">
        Aislamiento verificable: esta página consulta <code>tenants</code> con tu
        JWT; RLS garantiza que solo tu organización activa es visible.
      </p>
    </section>
  );
}
