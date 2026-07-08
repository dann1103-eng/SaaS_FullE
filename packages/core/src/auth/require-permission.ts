// Guard de aplicación (CLAUDE.md regla 8; defensa en profundidad P9).
// La MISMA regla vive en RLS via app.has_permission — esto corta antes y con
// mejor error; la BD sigue siendo la frontera dura.
import type { SupabaseServerClient } from "@plataforma/db";

import { hasPermission } from "./permissions";
import { getAuthContext, PermissionDeniedError, type AuthContext } from "./session";

export interface PermissionContext extends AuthContext {
  tenantId: string;
  grants: string[];
}

/** Grants del rol del usuario en su tenant activo (RLS limita a lo propio). */
export async function fetchGrants(
  supabase: SupabaseServerClient,
  userId: string,
  tenantId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("status, role:roles(role_permissions(permission_key))")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`No se pudieron leer los permisos: ${error.message}`);
  return data?.role?.role_permissions.map((p) => p.permission_key) ?? [];
}

/**
 * Lanza PermissionDeniedError si el usuario no tiene el permiso en su tenant
 * activo. Devuelve el contexto (user, tenantId, grants) para la acción.
 */
export async function requirePermission(
  supabase: SupabaseServerClient,
  permission: string,
): Promise<PermissionContext> {
  const ctx = await getAuthContext(supabase);
  if (!ctx.tenantId) {
    throw new PermissionDeniedError(permission, "sin tenant activo en la sesión");
  }
  const grants = await fetchGrants(supabase, ctx.user.id, ctx.tenantId);
  if (!hasPermission(grants, permission)) {
    throw new PermissionDeniedError(permission);
  }
  return { ...ctx, tenantId: ctx.tenantId, grants };
}
