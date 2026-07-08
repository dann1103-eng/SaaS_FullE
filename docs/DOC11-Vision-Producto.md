# DOCUMENTO 11 — Visión de Producto
### El negocio, no el software
*Iteración 3.*

---

## 1. La tesis de negocio

Durante años vendiste desarrollo a medida y, sin planearlo, construiste seis veces el mismo producto para seis industrias. La visión es dejar de vender horas y empezar a vender **el sistema operativo de la PyME latinoamericana**: una plataforma modular donde una empresa se registra sola, activa lo que necesita, paga solo eso, y obtiene en una tarde lo que hoy requiere seis herramientas gringas mal pegadas o un desarrollo a medida de meses.

La filosofía fundacional se mantiene textual: **"No reemplazar personas. Eliminar trabajo repetitivo para que las personas hagan trabajo de mayor valor."** Operativamente: cada módulo debe poder responder "¿qué tarea manual eliminó este mes?" — esa es la métrica de producto, no los logins.

## 2. Propuesta de valor (por qué una empresa elegiría esto)

1. **Sustitución, no suma:** una PyME de servicios hoy paga CRM + facturador + agenda + WhatsApp manual + Excel de nómina + control horario. Un solo lugar, un solo dato del cliente, un precio menor a la suma.
2. **Nacida para operar en LatAm:** IVA/retenciones/DTE, nómina ISSS/AFP/ISR, WhatsApp como canal primario, pasarelas locales, español coloquial en la IA, precios en USD accesibles. Salesforce y Monday no compiten aquí; compiten el Excel y el cuaderno.
3. **IA que trabaja, no que chatea:** el agente cobra facturas, agenda citas y llena boletas por voz — con permisos, auditoría y costo medido. Es la diferencia entre "tenemos un chatbot" y "contratamos un empleado digital".
4. **Modular de verdad:** activar/desactivar módulos con dependencias resueltas (DOC7), pagar por módulo activo. El cliente chico empieza con 2 módulos a precio de app; crece hasta ERP sin migrar jamás.
5. **Verticales con opinión:** packs por industria con plantillas reales (pipelines, checklists, vocabularios) destiladas de sistemas en producción — no un lienzo en blanco tipo Notion que el cliente debe diseñar.
6. **Probada antes de nacer:** cada motor del catálogo ya opera en una empresa real. El pitch honesto: "esto no es un MVP; es la sexta versión".

## 3. Posicionamiento frente a los grandes

| Frente a | Su debilidad en este mercado | Nuestra jugada |
|---|---|---|
| **Salesforce/HubSpot** | Precio, complejidad, implementadores caros, cero operación (agenda/campo/nómina) | Operación completa a precio PyME, self-service, español real |
| **Zoho/Odoo** | Los más parecidos en amplitud; genéricos, localización LatAm débil, IA superficial, Odoo exige partner técnico | Verticales con opinión + IA agéntica + fiscal/nómina CA nativa + self-service sin partner |
| **Monday/ClickUp/Notion** | Gestión del trabajo, no del negocio: no facturan, no cobran, no agendan con reglas, no corren nómina | "Ellos organizan tareas; nosotros operamos tu empresa y cobramos tu dinero" |
| **ServiceNow** | Enterprise puro | No competimos; inspiración de workflows |
| **Verticales puntuales** (Jobber, simPRO, Mindbody, Frame.io, Deel…) | Uno por industria, en inglés, sin el resto de la operación | Un vertical pack de la misma plataforma: mismo login, mismos datos, más barato |

**Frase de posicionamiento:** *"El ERP que las PyMEs de LatAm sí pueden usar: modular, con IA que ejecuta, y hecho para cómo se trabaja aquí."*

## 4. Modelo comercial

- **Precio por módulo activo** (base + por usuario en módulos de asiento como Chat/Tiempo) + **IA por consumo** con cuota incluida (el metering ya existe).
- **Bundles verticales** con descuento (ancla de venta) — DOC6 §6.
- **Self-service** para la larga cola + **onboarding asistido** (tu equipo) como servicio para tickets medianos: convierte tu negocio actual de servicios en el canal de implantación de tu propio producto.
- **Land & expand estructural:** cada módulo activo aumenta el valor del agente IA y del portal (efecto compuesto documentado en DOC7 §4.5) → el churn baja con cada activación.

## 5. Ventajas competitivas construibles (los fosos)

1. **Datos operativos + IA por vertical:** los agentes se afinan por industria con vocabulario y flujos reales (ya tienes el coloquial salvadoreño de campo destilado en prompts).
2. **Costo de cambio creciente:** cuando facturación, agenda, nómina y WhatsApp viven juntos, irse cuesta más que quedarse (a diferencia de un CRM suelto).
3. **Localización fiscal como plugin:** cada país agregado (SV→GT→CR→…) es un mercado nuevo con barrera técnica que los verticales gringos no cruzarán.
4. **Plantillas comunitarias (V3+):** consultores e implementadores publican pipelines/formularios/packs → ecosistema.
5. **Velocidad estructural:** monorepo + eventos + manifests + Claude Code = capacidad de sacar un módulo nuevo en semanas; los incumbentes tardan trimestres.

## 6. Evolución a 10 años

- **Años 1–2 — El Salvador, 3 verticales, 100 tenants.** Servicios Recurrentes como buque insignia; el agente IA como titular de prensa; tu cartera y red como primeros canales.
- **Años 3–4 — Centroamérica, 6 verticales, 1,000 tenants.** Plugins fiscales GT/CR/PA/HN; partners de implementación; API pública consolidada; marketplace de plantillas.
- **Años 5–7 — LatAm hispana, plataforma de agentes.** El producto se re-centra: los módulos son las manos, los agentes son el producto ("tu recepcionista digital", "tu cobrador digital", "tu supervisor digital") con resultados medidos (dinero cobrado, horas ahorradas). Pricing evoluciona hacia outcome-based en módulos maduros.
- **Años 8–10 — Sistema operativo + red.** Datos agregados (anónimos) → benchmarks por industria y país; financiamiento embebido sobre el ledger (adelantos contra facturas conciliadas); interoperabilidad entre tenants (un tenant de distribución le vende a un tenant de retail dentro de la red). La plataforma deja de ser software que una empresa usa y pasa a ser infraestructura sobre la que las PyMEs de la región operan entre sí.

## 7. Qué NO seremos (disciplina)

No un ERP contable-formal (integramos contadores, no los reemplazamos — hasta que un país lo pida como plugin), no enterprise (>500 empleados), no un builder genérico sin opinión, no una consultora con producto de excusa: el producto manda y los servicios lo implantan.

## 8. El nombre del riesgo principal

El riesgo no es técnico (el código existe seis veces) ni de mercado (seis industrias ya pagaron por esto). Es **foco**: la tentación de construir los 26 módulos antes de vender el primero. El antídoto está firmado en DOC10: un bundle, dos design partners, GA privada — y el catálogo completo como mapa, no como lista de tareas.
