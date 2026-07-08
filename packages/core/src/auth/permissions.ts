// Semántica de permisos de la plataforma (CLAUDE.md · convención mXX.recurso.accion).
// PARIDAD EXACTA con app.has_permission (migración 0001 §8):
//   rp = '*'  OR  rp = p  OR  (rp LIKE '%.*' AND p LIKE replace(rp,'*','') || '%')
// La BD la aplica en RLS; esta copia sirve al guard de aplicación
// (requirePermission) — defensa en profundidad P9, misma regla en ambas capas.

/** ¿El grant concedido cubre el permiso requerido? */
export function permissionMatches(granted: string, required: string): boolean {
  if (granted === "*") return true;
  if (granted === required) return true;
  if (granted.endsWith(".*")) {
    // 'm06.*' → prefijo 'm06.' (igual que replace(rp,'*','') en SQL)
    return required.startsWith(granted.slice(0, -1));
  }
  return false;
}

/** ¿Alguno de los grants del rol cubre el permiso requerido? */
export function hasPermission(granted: readonly string[], required: string): boolean {
  return granted.some((g) => permissionMatches(g, required));
}
