// Convención de claves de evento (DOC8: modulo.entidad.accion_pasado).
// PARIDAD EXACTA con el CHECK de public.domain_events.event_key (migración
// 0002). El catálogo es cerrado: agregar una clave nueva requiere ADR corto
// en docs/adr/ (CLAUDE.md · Convenciones).
const EVENT_KEY_PATTERN = /^(core|m[0-9]{2})\.[a-z0-9_]+\.[a-z0-9_]+$/;

export function isValidEventKey(key: string): boolean {
  return EVENT_KEY_PATTERN.test(key);
}

export function assertValidEventKey(key: string): void {
  if (!isValidEventKey(key)) {
    throw new Error(
      `Clave de evento inválida: "${key}" (convención DOC8: modulo.entidad.accion_pasado)`,
    );
  }
}
