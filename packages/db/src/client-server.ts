// Cliente Supabase para código de servidor (RSC, server actions, proxy).
// Framework-agnóstico: el adaptador de cookies lo aporta la app (Next pasa
// next/headers o NextRequest/NextResponse). Patrón oficial @supabase/ssr.
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { publicEnv } from "./env";
import type { Database } from "./types";

export interface SupabaseCookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options: CookieOptions }[]): void;
}

export function createSupabaseServerClient(cookies: SupabaseCookieAdapter) {
  const env = publicEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies },
  );
}

export type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;
