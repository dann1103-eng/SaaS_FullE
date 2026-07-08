// Cliente service_role — SOLO webhooks/jobs/seeds con tenant_id explícito
// validado (CLAUDE.md regla 9). Jamás en el navegador ni en render de páginas.
import { createClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "./env";
import type { Database } from "./types";

export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("service_role solo en servidor (CLAUDE.md regla 9)");
  }
  return createClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
