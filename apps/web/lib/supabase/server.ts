// Glue Next → @plataforma/db: cliente Supabase ligado a las cookies de la
// request actual (RSC y server actions).
import { createSupabaseServerClient } from "@plataforma/db";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      } catch {
        // Un Server Component no puede escribir cookies; el refresh de sesión
        // lo garantiza el proxy. Ignorar aquí es el patrón oficial de Supabase.
      }
    },
  });
}
