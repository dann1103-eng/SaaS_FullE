# packages/modules

Los módulos de negocio viven aquí, **un paquete por módulo**, con la convención
`mXX-nombre/` (p. ej. `m01-crm/`, `m02-catalog/`) y un `module.manifest.ts`
(key, dependsOn, permissions, produces, consumes, navItems, tools,
settingsSchema) — ver CLAUDE.md (Convenciones) y docs/DOC7.

**Regla dura n.º 3 (CLAUDE.md):** prohibido importar entre `packages/modules/*`.
La comunicación entre módulos es por DomainEvents (docs/DOC8) o servicios de
`packages/core`. La verificación en CI de esta regla se añade cuando exista el
primer módulo.

El primer módulo (M01 CRM) llega en la Sesión 7 (docs/DOC12 §5).
