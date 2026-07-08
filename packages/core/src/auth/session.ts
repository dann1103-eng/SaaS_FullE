// Contexto de sesión multi-tenant sobre Supabase Auth.
// El claim tenant_id lo inyecta public.custom_access_token_hook (migración
// 0001 §9) SOLO si hay membresía activa; aquí únicamente se lee.
import type { SupabaseServerClient } from "@plataforma/db";
import type { User } from "@supabase/supabase-js";

export class AuthenticationError extends Error {
  constructor(message = "Autenticación requerida") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class PermissionDeniedError extends Error {
  constructor(
    public readonly permission: string,
    detail = "",
  ) {
    super(`Permiso denegado: ${permission}${detail ? ` (${detail})` : ""}`);
    this.name = "PermissionDeniedError";
  }
}

export interface AuthContext {
  user: User;
  /** Tenant activo según el claim del JWT; null = sin membresía activa. */
  tenantId: string | null;
}

/** Payload del access token. Solo tras verificar la sesión con getUser(). */
export function decodeAccessTokenClaims(accessToken: string): Record<string, unknown> {
  const payload = accessToken.split(".")[1];
  if (!payload) throw new AuthenticationError("access token malformado");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}

/**
 * Usuario verificado + tenant activo del claim.
 * getUser() valida contra el servidor de Auth (no confía en la cookie);
 * el claim se lee del access token de esa misma sesión validada.
 */
export async function getAuthContext(supabase: SupabaseServerClient): Promise<AuthContext> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AuthenticationError();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  let tenantId: string | null = null;
  if (session) {
    const claims = decodeAccessTokenClaims(session.access_token);
    tenantId = typeof claims["tenant_id"] === "string" ? claims["tenant_id"] : null;
  }
  return { user, tenantId };
}
