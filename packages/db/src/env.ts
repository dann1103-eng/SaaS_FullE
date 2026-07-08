// Env tipado (CLAUDE.md regla 12: secretos solo en env tipado).
// Acceso literal a process.env.NEXT_PUBLIC_* para que Next lo inline en cliente.
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, { error: "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente o inválida" }),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, { error: "SUPABASE_SERVICE_ROLE_KEY ausente o inválida" }),
});

let cachedPublic: z.infer<typeof publicSchema> | undefined;
let cachedServer: z.infer<typeof serverSchema> | undefined;

export function publicEnv(): z.infer<typeof publicSchema> {
  cachedPublic ??= publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return cachedPublic;
}

export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() no puede usarse en el navegador");
  }
  cachedServer ??= serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return cachedServer;
}
