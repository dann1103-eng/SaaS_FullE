// Cliente Supabase para componentes de cliente (singleton por pestaña).
import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "./env";
import type { Database } from "./types";

export function createSupabaseBrowserClient() {
  const env = publicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
