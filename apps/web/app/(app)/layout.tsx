import { requireAuth } from "@/lib/auth";

import { logout, switchTenant } from "./actions";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { supabase, user, tenantId } = await requireAuth();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("tenant_id, tenant:tenants(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const activeTenant = memberships?.find((m) => m.tenant_id === tenantId)?.tenant;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Plataforma ____</span>
          {activeTenant ? (
            <span
              data-testid="active-tenant"
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium dark:bg-neutral-800"
            >
              {activeTenant.name}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
              Sin organización activa
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {memberships && memberships.length > 1 && (
            <form action={switchTenant} className="flex items-center gap-2">
              <label htmlFor="tenantId" className="sr-only">
                Cambiar de organización
              </label>
              <select
                id="tenantId"
                name="tenantId"
                defaultValue={tenantId ?? undefined}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                {memberships.map((m) => (
                  <option key={m.tenant_id} value={m.tenant_id}>
                    {m.tenant?.name ?? m.tenant_id}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700"
              >
                Cambiar
              </button>
            </form>
          )}
          <span data-testid="user-email" className="text-sm text-neutral-500">
            {user.email}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
