import { requireAuth } from "@/lib/auth";

import { markAllNotificationsRead, markNotificationRead } from "../actions";

export default async function NotificationsPage() {
  const { supabase, user } = await requireAuth();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unread = notifications?.filter((n) => !n.read_at).length ?? 0;

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notificaciones</h1>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
            >
              Marcar todas leídas ({unread})
            </button>
          </form>
        )}
      </div>

      <ul data-testid="notification-list" className="flex flex-col gap-2">
        {(notifications ?? []).length === 0 && (
          <li className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
            Sin notificaciones todavía.
          </li>
        )}
        {(notifications ?? []).map((n) => (
          <li
            key={n.id}
            className={`rounded-lg border p-4 ${
              n.read_at
                ? "border-neutral-200 opacity-70 dark:border-neutral-800"
                : "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-neutral-500">{n.body}</p>}
                <p className="mt-1 text-xs text-neutral-400">
                  <code>{n.type}</code> · {new Date(n.created_at).toLocaleString("es-SV")}
                </p>
              </div>
              {!n.read_at && (
                <form action={markNotificationRead}>
                  <input type="hidden" name="notificationId" value={n.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                  >
                    Marcar leída
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
