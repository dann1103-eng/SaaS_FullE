# DOCUMENTO 1 — Executive Analysis
### Plataforma SaaS Modular Self-Service Multi-Tenant
*Síntesis ejecutiva del análisis de los 6 sistemas. Iteración 3.*

> **Premisa operativa (decisión del fundador):** los clientes actuales conservan sus sistemas a medida intactos. La plataforma se construye **solo para clientes nuevos**. Consecuencia: los 6 codebases son **repositorios donantes** (lógica probada + patrones + UI), no sistemas legacy a migrar. Cero deuda de compatibilidad, cero migración de datos.

---

## 1. Qué se analizó

| Sistema | Vertical | En producción | Escala actual |
|---|---|---|---|
| FM CRM | Agencia de marketing | Sí | 45+ tablas, ~40 módulos de actions, bot WhatsApp IA activo |
| Kinetic CRM | Clínica de terapias infantiles | Sí | ~290 componentes, 12 roles, nómina fiscal SV |
| TAS Platform | Field service (seguridad electrónica) | Sí | ~50 usuarios internos + subcontratistas + 153 cuentas B2B |
| CAAA | Escuela de aviación | Sí | 65 tablas, ~80-100 alumnos, 4 aeronaves + simulador |
| ADEC Tienda | Pedidos e-commerce escolar | Sí | 3 tiendas WooCommerce, pipeline de ingesta |
| INNOLATTE | Distribución B2B de congelados | Sí | 20 listas de precios, rutas quincenales |

Seis verticales sin relación aparente. Un mismo stack de fondo (Supabase/Postgres + RLS), un mismo autor, y —lo decisivo— **un mismo conjunto de problemas resueltos una y otra vez**.

## 2. Hallazgo central

**El producto SaaS ya existe; está repartido en seis bases de datos.** Evidencia en tres capas:

1. **Genoma compartido literal:** Kinetic es un fork de FM CRM. Chat, llamadas, facturación, ciclos, pipeline, portal, tiempo y PDFs operan hoy en dos industrias distintas (agencia y clínica) con el mismo motor. Es una prueba de concepto multi-vertical en producción, no una hipótesis.
2. **Convergencia independiente:** capacidades reinventadas 2–5 veces sin copiarse — nómina fiscal con snapshot (Kinetic↔CAAA, diseño casi idéntico), workflow de revisión/aprobación (5 sistemas), portal externo (4), correo transaccional (3 motores distintos), ledger/créditos (CAAA↔FM), documentos con vencimiento (CAAA↔TAS), pedidos con catálogo (ADEC↔INNO). Si el mismo desarrollador lo construyó cinco veces para cinco clientes distintos, el mercado lo compra.
3. **Cuantificación:** de 40 entidades universales derivadas (DOC5), 31 tienen implementación en producción y 19 tienen dos o más. La hipótesis del 60–80% de solapamiento queda validada empíricamente.

## 3. Patrones encontrados (los 5 meta-patrones, detalle en DOC5 §2)

1. **Documento Revisable** — borrador→revisión→aprobación con auditoría y notificación (5/6 sistemas).
2. **Motor Económico** — acuerdo→ciclo→factura→pago→conciliación→ledger, con mora/gracia/suspensión/rollover (4/6).
3. **Reserva→Ejecución→Evidencia** — recurso agendado, máquina de estados, checklist/fotos/firma, consecuencia económica automática (4/6).
4. **Pipeline Configurable** — kanban de fases con efectos por transición; ya gobierna 3 dominios con el mismo motor (4/6).
5. **Conversación Omnicanal + Agente IA** — agente con herramientas de negocio reales (FM) + extractor conversacional de formularios (TAS): dos mitades complementarias de una plataforma AI-native ya escrita.

Transversales a todo: raw-first ingestion, snapshots inmutables, idempotencia por índices únicos parciales, ledger append-only, ancla+extensiones de identidad, defensa en profundidad, human-in-the-loop para excepciones (los 12 principios, DOC5 §1).

## 4. Similitudes y diferencias que importan

**Similitudes:** stack (Supabase/Postgres/RLS 6/6, Next.js 4/6, Vercel 4/6), zona horaria y fiscalidad SV, single-tenant sin excepción, patrón "core compartido + adaptadores por canal", exportadores PDF/Excel en todos.

**Diferencias aprovechables:** cada sistema aporta un motor que los demás no tienen — ledger prepagado (CAAA), reservas con conflictos 3D (CAAA), field service con evidencia (TAS), subcontratistas con días hábiles (TAS), listas de precios N (INNO), ingesta clasificada con excepciones (ADEC), proofing con pines (FM), agente IA transaccional (FM), nómina sellada (Kinetic). La plataforma no promedia los sistemas: toma el mejor motor de cada uno.

**Diferencias a eliminar:** tres motores de correo, dos de nómina, tres esquemas de auth (incluyendo contraseñas en texto plano en TAS — hallazgo crítico que la plataforma corrige por sustitución), dimensiones de negocio hardcodeadas, acoplamiento por `require()`/SQL cruzado en lugar de eventos.

## 5. Oportunidades

1. **Time-to-market anómalamente corto:** ~70% de la lógica de dominio ya está escrita, probada y en producción; parte es funciones puras testeadas (Kinetic `lib/domain`, ADEC `classify-core`, INNO `pricing`, TAS `calcEstado`) extraíbles casi tal cual.
2. **AI-native desde el día 1 con IA real:** agente que factura, agenda y consulta (no un chatbot) + captura conversacional de formularios. Ningún competidor del segmento PyME LatAm lo ofrece integrado; el tracking de costos por corrida (FM) habilita pricing por consumo.
3. **Posición geográfica/fiscal:** DTE, IVA 13%, ISSS/AFP/ISR, n1co, WhatsApp como canal dominante — localización SV/CA de fábrica que Salesforce/Monday no tienen ni tendrán pronto.
4. **Modelo comercial modular real:** el mecanismo de activación por tenant (feature flags por módulo) tiene semilla en el propio código (`tabsForRol` de TAS → `modulesForTenant`).
5. **Seis vertical packs listos para vender** desde el conocimiento de dominio ya adquirido (agencias, clínicas, field service, distribución, academias/flotas, comercio escolar).
6. **Sin lastre:** al no migrar clientes actuales, el diseño multi-tenant se hace bien desde la primera migración SQL.

## 6. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| **Alcance:** 26 módulos es un catálogo, no un MVP | Alta | Roadmap disciplinado (DOC10): un bundle primero (Servicios Recurrentes), el resto por demanda |
| **Multi-tenancy mal hecha** contamina todo lo demás | Alta | tenant_id + RLS + folios por tenant desde la migración 0001; test de aislamiento automatizado |
| **Generalización excesiva** (motor de todo, útil para nada) | Media-alta | Regla: solo se generaliza lo que ya existe 2+ veces; lo demás se copia del donante tal cual y se generaliza cuando aparezca el segundo caso |
| WhatsApp multi-tenant (un WABA por tenant, Embedded Signup de Meta) | Media | Fase 2 del canal; email primero como canal universal |
| Pasarela n1co no diseñada para plataforma multi-comercio | Media | Interfaz `PaymentProvider` desde el día 1; negociar con n1co o sumar Stripe/Wompi |
| Equipo de una persona + IA | Media | Modular monolith (no microservicios), monorepo, Claude Code con specs por módulo (DOC12) |
| Costos IA variables por tenant | Baja | Metering ya resuelto (FM); cuotas por plan |

## 7. Recomendación ejecutiva

Construir un **monolito modular multi-tenant** (Next.js + Supabase, el stack de los donantes principales) con activación de módulos por tenant, lanzando primero el bundle **Servicios Recurrentes** (Core + CRM + Catálogo + Agenda + Facturación + Pagos + Recurrencia + Portal + Reportes básicos), que es el heredero directo del genoma FM/Kinetic, el de mayor mercado y el que más lógica donante tiene disponible. El detalle de secuencia en DOC10 y el plan de ejecución con Claude Code en DOC12.
