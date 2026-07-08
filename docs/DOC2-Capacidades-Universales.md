# DOCUMENTO 2 — Universal Business Capabilities
### Plataforma SaaS Modular Self-Service Multi-Tenant
*Inventario de capacidades en lenguaje de negocio (la vista "qué puede hacer la plataforma"). Cada capacidad indica dónde ya existe. Iteración 3.*

Este documento es la vista comercial/product del ADN técnico (DOC5) y del catálogo (DOC6). Sirve como fuente para pricing, sitio web y material de venta.

---

## A. Capacidades de base (incluidas siempre)

| Capacidad | Qué significa para el negocio | Probada en |
|---|---|---|
| Identidad y roles | Un login, roles por módulo, permisos finos, suplantación auditada para soporte, sesión única | FM, Kinetic, 6/6 parcial |
| Organización y marcas | Multi-marca/sede/sucursal con identidad visual propia por unidad | FM, ADEC |
| Activación de módulos | Encender/apagar módulos y pagar solo lo activo (self-service) | Diseño (semilla en TAS) |
| Directorio universal | Personas y empresas una sola vez, compartidas por todos los módulos | 6/6 |
| Dimensiones propias | Cada empresa define sus ejes (sedes, zonas, canales, grados…) y todo se filtra/reporta por ellos | Generalización ADEC+INNO |
| Automatización y eventos | Todo lo que pasa dispara consecuencias configurables (notificar, crear, cobrar) | FM, ADEC, CAAA |
| Notificaciones confiables | Email/WhatsApp/in-app con reintentos, sin duplicados, con auditoría y modo prueba | ADEC, TAS, CAAA, Kinetic |
| Archivos | Adjuntos seguros en cualquier registro, enlaces firmados, ZIP | FM, Kinetic |
| Auditoría | Quién cambió qué y cuándo, con diff antes/después | CAAA, FM |
| Búsqueda global | Un buscador para clientes, órdenes, facturas, llamadas | TAS |
| Plataforma IA | La IA como infraestructura: agentes, extracción, costos medidos por empresa | FM, TAS |

## B. Capacidades comerciales y de clientes

| Capacidad | Negocio | Probada en |
|---|---|---|
| CRM de cuentas y contactos | Ficha completa (fiscal, comercial, redes), estados, notas, historial | 6/6 |
| Jerarquías y sucursales | Cliente padre ↔ sucursales con deduplicación automática | TAS |
| Leads y conversión | Captura (bot, formulario, campo), pipeline, conversión a cliente con métricas de respuesta | FM, TAS, Kinetic |
| Actividad y churn | Clientes activos/inactivos por recencia de compra | INNOLATTE |
| Portal del cliente | El cliente ve su agenda, facturas, entregables; paga, solicita y aprueba solo | FM, Kinetic, TAS, CAAA |

## C. Capacidades de venta y operación

| Capacidad | Negocio | Probada en |
|---|---|---|
| Catálogo con variantes | Productos/servicios, tallas/presentaciones, imágenes, import masivo | ADEC, INNO, Kinetic |
| Listas de precios | N listas por cliente, sin precios inventados (línea sin precio = bloqueada) | INNOLATTE |
| Toma de pedidos | Armador con defaults del cliente, overrides auditados, IVA, folio, snapshot | INNOLATTE |
| Ingesta de pedidos externos | Recibe pedidos de WooCommerce/otros, clasifica contra catálogo, nada se pierde | ADEC |
| Bandeja de excepciones | Lo que el sistema no resuelve va a una cola humana con motivo y reproceso | ADEC, FM, TAS |
| Órdenes de trabajo en campo | Captura móvil con fotos, firma, personal, materiales; cliente informado + encuesta | TAS |
| Agenda con reglas | Reservas sin choques (recurso+operador+cliente), capacidad, cierres, auto-agendamiento | Kinetic, CAAA, FM |
| Proyectos con terceros | Subcontratistas con plazos en días hábiles, avance diario con evidencia, confiabilidad por proveedor | TAS |
| Rutas de reparto | Horario por zonas y hoja de ruta diaria cruzada con pedidos pendientes | INNOLATTE |
| Flota y GPS | Paradas del día y ruta del vehículo de cada orden | TAS |

## D. Capacidades económicas

| Capacidad | Negocio | Probada en |
|---|---|---|
| Facturación y cotizaciones | Documentos fiscales con PDF, numeración, IVA/retención, DTE (SV) | FM, Kinetic, CAAA |
| Cobro online conciliado | Links de pago, webhook, matching automático, huérfanos a revisión | FM, Kinetic |
| Suscripciones y ciclos | Cobro recurrente automático, mora, gracia, suspensión y reactivación | FM, Kinetic |
| Saldo prepagado / créditos | Ledger inmutable: depósitos, consumos automáticos, paquetes, extracto, morosos | CAAA, FM |
| Motor de recargos | Mora por bloques, tarifas por tiempo (recogida tardía), multas por frecuencia | Kinetic, CAAA |
| Egresos | Gastos por categoría, generados también automáticamente (nómina, repuestos) | Kinetic, CAAA |
| Nómina fiscal | Dos regímenes (planta/honorarios), tramos por país, planilla sellada, recibo firmado | Kinetic, CAAA |

## E. Capacidades de trabajo interno

| Capacidad | Negocio | Probada en |
|---|---|---|
| Pipelines visuales | Kanban de fases configurables con responsables, deadlines y efectos automáticos | FM, Kinetic, TAS |
| Revisión y aprobación | Todo documento importante pasa por control de calidad medible | 5/6 |
| Proofing visual | Feedback con pines sobre imagen/video/PDF, versiones, aprobación del cliente | FM |
| Documentos y vencimientos | Qué documento necesita quién; alertas antes de vencer (30/60 días) | CAAA, TAS |
| Control de tiempo | Jornadas, timers por trabajo, productividad, timesheets | FM, Kinetic |
| Tareas | Asignación con timer integrado | FM |
| Chat y llamadas | Mensajería interna + voz/video/pantalla sin salir del sistema | FM, Kinetic |
| Mantenimiento de activos | Componentes, inspecciones por horas/ciclos/fecha, inventario con kardex | CAAA |
| Academia interna (LMS) | Cursos, materiales, evaluaciones, asistencia, avance teórico+práctico | CAAA |
| Reportes y dashboards | KPIs por rol, filtros por dimensión, comparativas, export PDF/Excel/CSV | 6/6 |
| Expediente unificado | Reporte que une todas las fuentes por una clave (ticket/orden/llamada) | TAS |

## F. Capacidades IA (diferenciador)

| Capacidad | Negocio | Probada en |
|---|---|---|
| Agente que ejecuta | Atiende WhatsApp 24/7 y **hace** cosas: consulta estado, factura extras, envía links de pago, agenda, escala a humano | FM (18 herramientas en producción) |
| Captura por narración | El operador dicta o narra; la IA llena el formulario con repreguntas y confirmación | TAS |
| Chat sobre tus datos | Preguntas en lenguaje natural sobre la operación y las ventas | TAS |
| Historial narrado | Resumen inteligente del cliente antes de la visita | TAS |
| Costos medidos | Consumo IA por empresa/uso → pricing por consumo | FM |

---

**Total: 47 capacidades**, 43 con implementación en producción hoy. La lista original de 33 conceptos del brief queda cubierta al 100% (mapeo en DOC6 §8).
