# DOCUMENTO 9 — AI-First Architecture
### La IA como capa transversal, no como chatbot
*Iteración 3. Sustrato técnico: C9 (DOC3 §9). Diferenciador comercial: M18. Punto de partida: dos sistemas de IA ya en producción (FM: agente con herramientas de negocio; TAS: extracción conversacional + chat sobre datos).*

---

## 1. Tesis

La plataforma no "tiene un bot": **la IA es un usuario más del sistema**, con identidad, permisos, auditoría y costo medido. Todo lo que la IA hace pasa por el mismo core de negocio que staff y portal (P11). Esto ya está demostrado en FM: el bot emite facturas reales con el mismo `invoice-create.ts` que usa el equipo.

## 2. Los cinco servicios IA de la plataforma (C9)

1. **Agent Runtime** — tool-use loop con historial por conversación, debounce, prompt caching, sanitizadores por canal, saludo institucional, handoff. (Origen: FM `whatsappReply.ts`, MAX_TOOL_ROUNDS=6.)
2. **Tool Registry** — cada módulo registra tools tipadas (zod) en su manifest; el runtime compone el catálogo según módulos activos + permisos del contexto (tenant/Account/audiencia). Toda ejecución emite `m18.agent.tool_executed` (auditable) y respeta RLS.
3. **Extraction Service** — narración libre (texto/voz vía Whisper) → JSON tipado contra un `ExtractionSchema` (campos + vocabularios controlados + guía de coloquialismos), con repreguntas de solo-lo-faltante y confirmación editable. (Origen: TAS `/api/extract`.)
4. **Insight Service** — chat sobre datos operativos por módulo. v1: contexto acotado (patrón TAS, con límites); v2: tools de consulta agregada por módulo (el chat "usa" los mismos reportes de M25) — evita el anti-patrón de volcar 150 filas al prompt.
5. **Metering & Guardrails** — costo por corrida (`cost_cents`, fórmula FM), cuotas por plan/tenant, kill-switch por tenant, límites de acciones sensibles (montos máximos facturables por bot, lista de tools que exigen confirmación humana).

## 3. Intervenciones IA por módulo (el mapa pedido en el brief)

| Módulo | Intervención IA | Base existente |
|---|---|---|
| M01 CRM | Historial narrado del cliente pre-visita/pre-llamada; dedupe asistido de cuentas; enriquecimiento de ficha desde conversaciones; scoring de leads | TAS historial narrado; FM submit_lead_info |
| M02 Catálogo | Alta asistida (foto/descripción→ítem+variantes); sugerencia de clasificación dimensional; detección de precios faltantes por lista | nuevo (bajo esfuerzo sobre Extraction) |
| M03 Pedidos | **Pedido por narración/WhatsApp** ("mándame 24 fresas 57g y 10 mezclas" → OrderLines con precios de la lista del cliente); resolución asistida de excepciones (sugerir el ítem de catálogo más probable, humano confirma) | Extraction + classify-core |
| M04 Field Service | **Boleta por voz** (el caso TAS completo, parametrizado por schema); resumen ejecutivo de la orden para el cliente; detección de oportunidad comercial en la narración | TAS extractor |
| M05 Agenda | Agendamiento conversacional ("¿tienes espacio el martes por la tarde?" → tool de disponibilidad + booking); sugeridor de reposición (ya existe como algoritmo Kinetic — el agente lo expone) | FM tools + Kinetic replacement-suggestions |
| M06/M07/M08 Económico | Las tools probadas de FM: estado de cuenta, facturas impagas, links de pago, **emitir extras/renovaciones** (idempotente), recordatorios de dunning con tono configurable | FM (en producción) |
| M09 Ledger | Consulta de saldo por bot; alerta narrada de morosidad al admin | tools nuevas triviales |
| M10 Pipelines | Resumen de tablero ("¿qué está atorado y por qué?"); redacción de actualización de estado para el cliente | Insight Service |
| M11 Revisión | Pre-revisión asistida (checklist de calidad sobre el documento antes del humano); resumen de cambios editados; borrador de comentario de rechazo | nuevo |
| M12 Compliance | Lectura de documentos subidos (¿es el documento correcto? ¿fecha de vencimiento?) → propone estado y vencimiento, humano confirma | nuevo (visión) |
| M13 Proyectos | Reporte diario por voz del subcontratista; resumen semanal de riesgo por proyecto para gerencia | Extraction + Insight |
| M14/M15 | Registro de tiempo por lenguaje natural; creación de tareas desde chat/menciones | tools triviales |
| M16 Chat | Resúmenes de canal/hilo; redacción asistida | nuevo |
| M17/M18 | El agente omnicanal completo: atención 24/7, multi-marca, handoff, leads | FM (en producción) |
| M19 Portal | El mismo agente embebido en el portal (web) además de WhatsApp | reutilización directa |
| M20 Nómina | Explicador de recibo ("¿por qué me descontaron $X?" → desglose ISR/ISSS/AFP desde el snapshot) | cálculo ya puro |
| M22 Activos | Registro de cumplimiento por voz en el taller; predicción simple de próxima falla por historial | Extraction |
| M25 Reportería | **Analista conversacional** sobre KPIs y agregados (v2 con tools de consulta); narrativa ejecutiva mensual autogenerada | TAS chats → re-arquitectura |
| M26 LMS | Generación de evaluaciones desde el material; retroalimentación de respuestas abiertas | nuevo |

## 4. Formularios como contrato universal

`FormDefinition` unifica tres cosas que hoy son distintas: el formulario UI, el `ExtractionSchema` del bot y la validación Zod del server. **Definir el formulario una vez ⇒ captura por pantalla, por voz y por chat quedan disponibles a la vez.** Es la generalización más rentable del corpus: convierte el add-on estrella de TAS en una propiedad de TODOS los módulos.

## 5. Arquitectura de datos para IA

- Historial de conversación: ventana configurable (`history_window`), colapso de turnos, staff etiquetado (FM `buildClaudeMessages`).
- Contexto de negocio: SIEMPRE vía tools (lectura fresca con RLS), nunca dumps al prompt (lección TAS).
- RAG (v2): embeddings por tenant (pgvector) para documentos/base de conocimiento del tenant → tools `search_knowledge`.
- Privacidad: aislamiento por tenant en todo (historiales, embeddings, configs); sin entrenamiento sobre datos de tenants; PII fuera de logs de jobs.

## 6. Modelo económico de la IA

Pricing por consumo con margen sobre `cost_cents` + cuota incluida por plan. El metering existe (FM); falta solo la capa de plan/cuota. Acciones de escritura del agente (facturar, agendar) pueden gatear por plan — el upsell natural: "tu bot puede *responder* gratis; que *cobre* por ti cuesta X".

## 7. Roadmap IA (alineado a DOC10)

- **v1 (con el MVP):** C9 base (runtime+registry+metering) + tools de lectura de M01/M06/M08 + agente en portal web (evita la fricción WABA de WhatsApp al inicio).
- **v1.1:** canal WhatsApp (M17) + tools de escritura económicas (links, extras) + handoff.
- **v2:** Extraction Service (boleta/pedido por voz) + Insight sobre M25 + pre-revisión M11.
- **v3:** RAG por tenant, visión para M12, analista narrativo mensual, agentes proactivos (dunning conversacional, seguimiento de leads).
