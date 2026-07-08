# DOCUMENTO 4 — Feature Extraction Blueprint
### Qué se cosecha de cada sistema donante
*Iteración 3. Los inventarios exhaustivos viven en las 6 documentaciones fuente; este documento es la **capa de decisión**: para cada sistema, qué se reutiliza (y hacia dónde), qué se transforma, qué se elimina y qué permanece vertical. Leyenda destino: C=Core, M=módulo (DOC6), V=vertical pack, P=patrón/principio (DOC5).*

> Recordatorio operativo: los sistemas donantes **siguen operando intactos para sus clientes**. "Cosechar" = copiar código/diseño al monorepo nuevo, no tocar el repo original.

---

## 1. FM CRM (donante principal #1)

### Se reutiliza casi tal cual
| Activo | Destino | Nota de cosecha |
|---|---|---|
| Cola `ai_jobs` + runner (claim atómico, backoff, job_events, costos) | C4/C9 | Generalizar `kind`; es el corazón de la automatización |
| Bot IA: tool-use loop, configs por audiencia, prompt caching, sanitizador WhatsApp, handoff | C9/M18 | Las 18 tools se reparten entre módulos vía tool registry |
| Webhook Meta (firma timing-safe, idempotencia wamid, media a storage) + plantillas HSM | M17 | Multi-tenant: número/WABA por tenant (fase 2 del canal) |
| n1co completo: links, webhook raw+auditoría+idempotencia, matcher por prioridades, huérfanos, callback UX | M07 | Extraer interfaz `PaymentProvider` |
| Ciclos: auto-billing 10 días antes, gracia, suspensión con gate, renovación, extras | M08 | Parámetros → `tenant_modules.config` |
| Motor fiscal `invoice-create.ts` (compartido portal/bot) + PDFs | M06 | Patrón P11 canonizado |
| Chat interno + llamadas LiveKit + presencia + dock flotante | M16 | Extracción casi directa (idéntico en Kinetic) |
| Time tracking (jornadas, breaks, timer único con guards) + tareas | M14/M15 | Guards `entry-guards.ts` → `packages/domain` |
| Proofing: assets/versiones/pines/hilos/gating + `clientMode` | M11 | Capacidad premium del módulo |
| Portal multi-marca con capacidades (`can_billing`/`can_work`) + elegibilidad compartida | M19 | ExternalIdentity del Core |
| Créditos idempotentes (materializar/consumir/refund) | M09 | Caso particular del ledger |
| Leads (`wa_leads`) + conversión a cliente | M01 | |
| RBAC + impersonación + sesión única + design tokens + primitivos UI | C1/ui | Base del design system |

### Se transforma
- 12 fases hardcodeadas → plantilla V2 sobre el motor Pipeline configurable (M10).
- Feed de notificaciones derivado (13 tablas) → productores por evento sobre tabla persistente (C5) — más simple de extender multi-módulo.
- `FM_BOT_USER_ID` hardcodeado ×3 → identidad de agente por tenant.
- Realtime + poll de respaldo + refetch on visibility → hook estándar del Core.

### Se elimina
Rutas de debug (`/api/debug/n1co-env`, `?secret=`), duplicado `sendWhatsappTemplate`, `.env.example` incompleto (antideuda: env tipado y completo desde día 1), suscripciones n1co bloqueadas por PCI (esperar SDK/iframe del proveedor).

---

## 2. Kinetic (donante principal #2)

### Se reutiliza
| Activo | Destino |
|---|---|
| `lib/domain/**` — **el activo más portable del corpus**: funciones puras testeadas de mora, late-pickup, nómina ISSS/AFP/ISR, capacidad/ocupación, solapamientos, sugeridor de reposición, agregaciones financieras | packages/domain (M08/M20/M05/M25) |
| Motor de agenda (solapamiento, cierres con bypass, multi-persona, drag&drop, reasignación/cobertura) + `KineticCalendar` + paletas por recurso | M05/ui |
| Nómina completa: 2 regímenes, config fiscal versionada, sellado con snapshot, firma de recibo, transferencias Excel | M20 |
| Ciclos mensuales WYSIWYG + rollover + regeneración | M08 |
| Capacidad contratada con semáforo (`therapist_work_schedule`, `max_hours_per_week`) | M05 |
| Ausencias + ventana de reposición 30d + sugeridor de slots | M05 |
| Workflow de informes (draft→approved→sent) + detección de pendientes | M11 |
| Egresos + reportería financiera (revenue, churn, comparativa anual) + factory PDF/Excel | M21/M25 |
| 12 roles con anti-escalada, guards por ruta, `DraftAutosave`/`useDraft` (autoguardado offline), `SessionSentinel` | C1/ui |
| Kanban de waitlist (17 subfases, alertas de estancamiento, avance crea familia+niño) | M10 (efectos por transición) |

### Se transforma
- Constantes de negocio exactas (recargo 5%/5días, $5+bloques 30min, ventana 30d, semáforos 60/85%) → parámetros de FeeRule/config por tenant.
- Consolidaciones que Kinetic ya detectó de sí mismo: `ModalWrapper` genérico, `ApprovalCard` genérico, unificar los 2 kanbans, factory de PDFs — se hacen en la plataforma, no en el donante.

### Se elimina
Nada estructural (es el donante más limpio). Legacy FM embebido no se re-cosecha (ya viene de FM directo).

### Permanece vertical (V1 Clínicas)
Expediente niño/familia, planes de tratamiento (`therapies_json`/`schedule_pattern_json` → se generaliza como Agreement, pero el editor clínico es V1), informes clínicos, despacho+recogida (motor de tarifa es M02/FeeRule; el flujo DispatchWatcher es V1), programas matutinos por grupo, fases de intake clínico.

---

## 3. TAS Platform

### Se reutiliza
| Activo | Destino |
|---|---|
| Extractor conversacional (prompt+pipeline narración→JSON 18 campos, repreguntas con chips, confirmación editable) | M18 (parametrizado por ExtractionSchema) |
| Transcripción Whisper (endpoint operativo) | C9 servicio de voz |
| Workflow revisión: edición auditada con detección real de cambios, comentario, reproceso, circuito "dato faltante→responsable→regresa" (caso #SAP), tiempos medidos | M11 |
| Subcontratos completo: `calcEstado` días hábiles (funciones puras), avance multi-actividad, fotos tipadas, firma, 6 avisos cron, confiabilidad por empresa | M13 |
| RRHH de proveedores (roster, DUI/ISSS, semáforo vencimientos 30/60) | M13+M12 |
| CRM: jerarquía padre/sucursal, dedupe case-insensitive con score, 15 campos, historial | M01 |
| Adapter Geotab (sesión cacheada+retry, paradas, ruta downsampled, geocodificación batch) → interfaz `FleetProvider` | M24 |
| Motor de correos multi-transporte con prioridad + TEST_MODE + plantillas con layout común | C5 |
| Reporte unificado por clave externa + PDF | M25 |
| Firma SVG multiplataforma, time-picker de ruedas, encuesta por URL prellenada (Tally), suite de auto-diagnóstico, notification-counts | M04/ui/C5 |
| Búsqueda global inteligente | C8 |

### Se transforma
- Chats IA con contexto de 150 filas → re-arquitectura sobre tools/RAG (M18, ya señalado por el propio doc).
- Pipeline comercial (field-to-sales) → instancia de M10 + tools de M18; el flag `hay_cotizacion` → efecto de transición.
- `parseDataUrl`, `calcHours`, `getDateRange` (duplicados ×2-3) → `packages/domain/shared`.

### Se elimina (antideuda explícita)
**Auth completa** (password_hash en texto plano, default `TAS2026!`) → C1 la sustituye; tablas legacy (`tecnicos`, `dashboard_usuarios`); patrón self-healing de esquema (innecesario con pipeline real de migraciones); discrepancias singular/plural (`reportes_tecnicos`); excepción por username (`maribel.santos`) → permisos reales.

### Permanece vertical (V3 Field Service/Seguridad)
Vocabularios del extractor (frases coloquiales SV, 18 campos de boleta), plantillas de correo específicas, semántica "llamada SAP" (se generaliza como `external_ref` con label por tenant).

---

## 4. CAAA

### Se reutiliza
| Activo | Destino |
|---|---|
| **Ledger prepagado**: movimiento inmutable tipado, saldo cacheado, edición con recálculo en cascada, anulación por contrapartida, recibos, conceptos de cobro | M09 |
| Motor de reservas con conflictos 3D + verificación en memoria y en BD + publicación de semana en lote + auto-agendamiento con límites | M05 |
| Nómina (validación cruzada del diseño Kinetic; tomar de aquí: `pago_teoria_pendiente` como patrón de "insumo externo por evento") | M20 |
| Taller: componentes, tareas por horas/ciclos/fecha, cumplimiento resetea reloj, kardex + egreso automático, caché sincronizada (P10) | M22 |
| Documentos requeridos + vencimientos (catálogo configurable, contratos como filas) | M12 |
| LMS completo (cursos, evaluaciones interno/autoridad, asistencia precargada, disparadores) | M26 |
| Auditoría con diff antes/después | C7 |
| Máquina de estados con bitácora + checklist obligatorio pre-cierre + multa por frecuencia | Doc5 §7 / M04 / FeeRule |
| Patrón kiosco (vista pasiva TV, refresco híbrido socket+polling, clave compartida) | widget M25 |
| PDFs financieros pdfkit con watermark de anulación | M06 |

### Se transforma
- Cargo automático al cerrar vuelo (import directo entre controladores) → efecto de transición que emite `booking.completed` → M09 cobra (corrige el bug de los dos caminos a COMPLETADO).
- Bloqueo de aeronave solo desde módulo legado → transición de estado del Asset en M22.
- "Avance de horas por tipo de aeronave" → "avance por categoría de actividad" (M26).
- Enum drift (`vuelo_estado_tiempo` sin EN_PROGRESO) → imposible por diseño (estados en configuración, no en CHECKs duplicados).

### Se elimina
Backend Express separado (todo converge al stack de plataforma), módulo de mantenimiento legado (solo se migra su capacidad de bloqueo), placeholders sin función (3 botones de export), filtros de auditoría declarados-no-aplicados, código muerto (`plantillaToAC.js`).

### Permanece vertical (V4 Aviación)
Peso y Balance/loadsheet (el módulo más específico del corpus — vendible solo dentro del vertical), estados de vuelo (SALIDA_HANGAR…), checklist 19 ítems como plantilla, METAR decodificado, licencias PP/IFR/CPL/MULTI/INST.

---

## 5. ADEC Tienda

### Se reutiliza
| Activo | Destino |
|---|---|
| Pipeline raw-first completo (guardar crudo→200→after()→cron respaldo, idempotencia por (store, order_id)) | C4/M03 |
| `classify-core` (lógica pura testeada de clasificación por catálogo, sin heurísticas) | M03 |
| Bandeja de excepciones (estado+nota+reproceso) | P7 → instancias M03/M07/M11 |
| Correos transaccionales con reintentos + índice único anti-duplicado + theming por marca | C5 |
| Importador CSV con validación por fila y upsert por lotes | M02 |
| Catálogo con variantes (tallas) + imágenes | M02 |
| Reportería por dimensiones (matrices talla×grado, agrupación por proveedor) | M25 (sobre Dimensions C3) |
| Filtros URL+debounce, badges de estado, EmptyState, BarrasH | ui |

### Se transforma
- Dimensiones colegio/sede/grado hardcodeadas → Dimensions configurables (C3) — la transformación que su propio doc pide.
- Adaptador WooCommerce (`parse.ts`) → primer `OrderSourceAdapter` tras interfaz.
- Normalizadores de texto específicos → configurables por tenant (V6).

### Se elimina
Rol `'colegio'` a medio construir (C1 lo resuelve bien), gestión de dimensiones por SQL manual (UI de C3).

### Permanece vertical (V6 Comercio Escolar)
Semántica encargado/alumno/nivel, plantillas de confirmación a padres, mapeos meta_data de WooCommerce escolar.

---

## 6. INNOLATTE

### Se reutiliza
| Activo | Destino |
|---|---|
| Motor de precios por lista (funciones puras, sin fallback, excepciones por categoría) | M02 |
| Patrón documento-snapshot + herencia/override + recálculo server + rollback | M03/M06 (P2 canonizado) |
| Correlativos por prefijo + códigos compuestos con "crear componente" inline | M01/M02 |
| Armador de pedidos (búsqueda incremental, líneas bloqueadas sin precio, precio manual ámbar) | M03 |
| Rutas: horario quincenal + hoja de ruta con pendientes + presets | M23 |
| Exportadores (Excel 2 hojas estilizado, CSV BOM, PDF 2 columnas con balanceo) respetando filtros URL | M25 |
| Actividad derivada / churn (60 días) | M01 |
| Utilidades dinero/TZ (round6/2, hoyISO, formatCurrency es-SV) | core/locale |
| Cambio de estado inline coloreado | ui |

### Se transforma
- Distritos por texto libre → GeoAreas normalizadas (M23).
- Enum 2 roles → RBAC C1. IVA/moneda/etiquetas constantes → settings por tenant.
- Importador Excel → herramienta de onboarding de tenants (generalizada).

### Se elimina
Keepalive (irrelevante en plan pago), duplicaciones ya inventariadas (`asegurarAdmin` ×3, presets ×2, etc. — nacen unificadas en packages).

### Permanece vertical (V5 Distribución)
Nomenclatura 3+3+3+2 como plantilla, presets de canales/etiquetas CD1-7/PL, regla especial MEZCLAS.

---

## 7. Resumen de cosecha

| Origen | % del sistema que se cosecha (estimado) | Activos estrella |
|---|---|---|
| FM | ~75% | Cola de jobs, agente IA, pagos, ciclos, chat, proofing, portal |
| Kinetic | ~70% | lib/domain puro, agenda, nómina, capacidad, aprobaciones |
| TAS | ~60% | Extractor IA, revisión auditada, subcontratos, multi-transporte correo |
| CAAA | ~55% | Ledger, reservas 3D, taller, LMS, documentos, auditoría |
| ADEC | ~70% | Raw-first, classify-core, excepciones, notificaciones idempotentes |
| INNOLATTE | ~65% | Pricing por listas, snapshot+override, rutas, exportadores |

Regla de extracción para Claude Code: **primero la lógica pura** (tests incluidos), luego el esquema (reescrito con tenant_id), luego la UI (sobre el design system unificado). Nunca copiar auth, env handling ni acoplamientos cruzados de los donantes.
