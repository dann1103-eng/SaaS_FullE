# Plataforma ____ (repo "plataforma")

SaaS modular multi-tenant self-service para PyMEs LatAm: un Core (tenancy, auth,
eventos, jobs, notificaciones, IA) + módulos activables por tenant (CRM,
facturación, pagos, recurrencia, agenda, portal…), construido cosechando la
lógica probada de seis sistemas donantes.

**La especificación manda.** Toda decisión de diseño vive en [docs/](docs/)
(DOC1..DOC12); ante cualquier duda, el documento tiene la última palabra y las
desviaciones se registran como ADR en [docs/adr/](docs/adr/).

- [CLAUDE.md](CLAUDE.md) — constitución del repo (reglas duras y convenciones).
- [ROADMAP.md](ROADMAP.md) — estado de las 17 sesiones de la Fase 0–1 (DOC12 §5).
- [docs/DOC3-Core-Platform.md](docs/DOC3-Core-Platform.md) — stack y contratos del Core.

## Estructura (DOC3 §0)

```
├── apps/web/                  # Next.js App Router (staff + portal + auth)
├── packages/
│   ├── db/                    # tipos generados, cliente Supabase, helpers RLS
│   ├── core/                  # C1–C9: tenancy, eventos, jobs, notificaciones, permisos
│   ├── domain/                # lógica pura por módulo (cosechada de los donantes)
│   ├── ui/                    # design system (tokens + primitivos)
│   └── modules/               # m01-crm/ m02-catalog/ ... (desde la Sesión 7)
├── supabase/                  # migrations/ + functions/ (CLI)
├── tooling/                   # tsconfig y eslint compartidos, scripts
└── docs/                      # DOC1..DOC12 + adr/ + specs/
```

## Comandos

```bash
pnpm install        # instalar el workspace
pnpm dev            # apps/web en desarrollo
pnpm typecheck      # tsc en todos los paquetes (turbo)
pnpm lint           # eslint en todos los paquetes (turbo)
pnpm test           # vitest en todos los paquetes (turbo)
pnpm build          # build de producción
```

Requisitos: Node ≥ 22, pnpm 10, Supabase CLI.

## Notas de estado (Sesión 0)

- La migración [0001_tenancy_foundation.sql](0001_tenancy_foundation.sql) está
  en la raíz **a propósito**: se mueve/renombra a `supabase/migrations/` con la
  convención de timestamp del CLI en la **Sesión 1**.
- El nombre de la plataforma está pendiente; el scope npm interino es
  `@plataforma/*` y se renombrará al decidirlo.
