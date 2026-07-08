# DOCUMENTO 7 — Dependency Graph
### Grafo formal de dependencias y reglas de activación
*Iteración 3. Este documento es máquina-legible por diseño: alimenta los manifests de módulo.*

---

## 1. Tipos de dependencia

- **HARD** — el módulo no funciona sin el otro (bloquea activación).
- **SOFT** — funciona sin él; si el otro está activo, se enriquece automáticamente (integración por eventos).
- **DATA** — solo lee datos del otro (agregadores); se activa igual pero con secciones vacías.

## 2. Matriz de dependencias

| Módulo | HARD | SOFT | Notas |
|---|---|---|---|
| M01 CRM & Cuentas | Core | M10 (pipeline de leads), M17 (contactos WA), M25 | Instalable solo |
| M02 Catálogo & Precios | Core | M01 (defaults por cuenta) | Instalable solo |
| M03 Pedidos & Comercio | M01, M02 | M23 (pendientes de entrega), M25, C5 | |
| M04 Field Service | M01 | M02 (materiales), M05 (si agendado), M11, M24, M18, M25 | Instalable con solo CRM |
| M05 Agenda & Reservas | M01 | M08 (generación por ciclo), M09 (cargo al completar), M19 (auto-agenda), M22 (bloqueo de activo) | Resources viven en C3 |
| M06 Facturación | M01 | M02 (líneas de catálogo), M07, M25 | Puede facturar líneas libres sin M02 |
| M07 Pagos & Conciliación | M06 | M09 (extras→créditos), M08 | |
| M08 Recurrencia & Morosidad | M06 | M07 (links), M05 (bookings del ciclo), M09, M19 | Agreements viven aquí |
| M09 Ledger/Prepago | M01 | M06 (facturar desde ledger), M05 (cargo por booking), M02 (tarifas) | Instalable con solo CRM |
| M10 Pipelines & Workflows | Core | cualquier entidad (`target_type`) | Instalable solo |
| M11 Revisión & Aprobaciones | Core | M04/M10/M13/M19 (documentos de origen), C5 | El proofing requiere C6 |
| M12 Documentos & Compliance | M01 | C5 (alertas), M13 (workers de vendors) | |
| M13 Proyectos & Subcontratistas | M01 | M11 (aprobación de avances), M12, M25, C5 | Vendors en M01 |
| M14 Tiempo & Jornadas | Core | M10 (timers de fase), M15, M20, M25 | Instalable solo |
| M15 Tareas | Core | M14 (timer) | Instalable solo |
| M16 Chat & Llamadas | Core | menciones/share-cards de módulos activos | Instalable solo |
| M17 Mensajería Omnicanal | M01 | M18 (agente), C5 (plantillas) | Canal sin IA es válido |
| M18 Agentes IA | C9, M17 (canal) | tools de TODOS los módulos activos | Add-on; valor ∝ módulos activos |
| M19 Portal de Clientes | M01 | expone M05/M06/M07/M08/M09/M10/M11/M12 según activos | Secciones del portal = módulos activos |
| M20 Nómina & Fiscal | Core (empleados C1) | M14 (horas), M04/M05 (pago por servicio vía eventos), M21 (egreso al pagar) | |
| M21 Egresos | Core | M20, M22 (consumo→egreso), M25 | Instalable solo |
| M22 Activos & Mantenimiento | Core | M04/M05 (horas del activo por eventos), M21, M25 | Instalable solo |
| M23 Rutas & Logística | M01 (zonas) | M03 (pendientes de entrega) | Degrada con gracia sin M03 (patrón INNO) |
| M24 Flota & GPS | credenciales AVL | M04 (correlación por placa) | Instalable solo |
| M25 Reportería | Core | DATA de todos los activos | Agregador puro |
| M26 LMS | M01 | M04/M05 (horas prácticas por eventos), M20 (pagos de teoría), C5 | |

## 3. Grafo (dirección = "requiere/alimenta")

```
                              CORE (C1–C9)
                                  │
        ┌───────────┬─────────────┼──────────────┬─────────────┐
        ▼           ▼             ▼              ▼             ▼
      M01 ────► M02 ────► M03   M10   M14 ─► M15/M20   M16  M22/M24 (solos)
        │         │         │      \            │
        │         ▼         ▼       \(gobierna) ▼
        ├──────► M05 ◄─── M08 ◄─── M06 ─► M07  M21
        │         │         ▲        ▲      │
        │         ▼         │        │      ▼
        │       M04 ─► M11 ─┼────────┼──► M09
        │         │         │        │
        ├─► M13 ──┘   M12   │        │
        ├─► M17 ─► M18 (tools de todo lo activo)
        └─► M19 (expone lo activo)          M23 ◄─ M03
                        M25 ◄═══ DATA de todos          M26 ◄─ eventos M04/M05
```

## 4. Reglas de activación (lógica self-service)

1. **Activar módulo X** ⇒ validar HARD deps activas; si faltan, ofrecer activarlas en el mismo paso (upsell natural).
2. **Desactivar módulo X** ⇒ bloquear si otro módulo activo tiene HARD dep sobre X; los SOFT solo pierden la integración (los manejadores de eventos de X dejan de ejecutarse; los datos quedan, solo se ocultan).
3. **Datos al desactivar:** nunca se borran; el módulo pasa a `status='suspended'`, la navegación lo oculta, las RLS siguen protegiendo. Reactivar = todo vuelve.
4. **SOFT por eventos:** un módulo jamás consulta tablas de otro; se suscribe a sus eventos (DOC8) o llama su servicio interno. Si el productor no está activo, simplemente no llegan eventos — cero condicionales cruzados.
5. **Portal (M19) y Agente (M18) son "espejos":** su superficie se compone en runtime del manifest de los módulos activos (secciones del portal; tools del agente).
6. **Vertical packs** = bundle de módulos + plantillas (pipelines, estados, checklists, vocabularios, roles) + labels de dominio. Activar V1 = activar sus módulos + sembrar sus plantillas.

## 5. Conjuntos mínimos válidos (validación del modelo)

| Objetivo del cliente | Activación mínima |
|---|---|
| "Solo quiero facturar" | Core+M01+M06 |
| "Cobrar suscripciones" | +M07+M08 |
| "Agendar citas" | Core+M01+M05 |
| "Técnicos en campo" | Core+M01+M04 |
| "Prepago tipo escuela/gym" | Core+M01+M09 (+M05) |
| "Pedidos de distribución" | Core+M01+M02+M03 |
| "Solo colaboración interna" | Core+M14+M15+M16 |
| "Bot que atiende y cobra" | Core+M01+M06+M07+M17+M18 |

Cada fila es un tenant válido — esa es la prueba de que el grafo soporta self-service real y precios por módulo.
