# PLAN MAESTRO (2026) — InventoryTW

> Objetivo: tener un backlog integral y ordenado de **módulos**, **lógicas** y **templates** (pantallas/reportes/PDF/print) para completar InventoryTW.
>
> **Exclusión explícita**: este plan **NO** incluye el módulo de impresión de etiquetas: rutas `/print-label` y `/print-labels`, BrowserPrint, ZPL, SDK Zebra.

---

## 0) Estado actual (rápido)

### Módulos/rutas ya presentes en `src/app/` (alto nivel)
- Home: `/`.
- Documentos: `/documents`, `/documents/new`, `/documents/[documentId]/print`, `/documents/[documentId]/pdf`.
- Kardex: `/kardex`.
- Stock: `/stock`.
- Maestros (UI): `/taxes`, `/product-groups`, `/tables`, `/company`, `/settings`.
- Partners: `/partners`, `/partners/manage`.
- Otros: `/users`, `/user-security`, `/reports`, `/reporting`, `/payment-methods`, `/price-lists`, `/paises`, `/documentation`.

### Servicios y patrones ya en uso
- Amplify Data via `amplifyClient` en `src/lib/amplify-config.ts`.
- Server Actions en `src/actions/`.
- Servicios de negocio en `src/services/`.
- Documentos finalizan y postean Stock + Kardex; Kardex guarda trazabilidad (documentId/documentItemId/warehouseId) y snapshots (costo/precios).

---

## 1) Estándar de “templates” (cómo debe verse cada módulo)

Para que el sistema quede consistente, cada módulo debería tener (según aplique):

### 1.1 Template: Lista (tabla)
- Tabla paginada (limit/nextToken) + ordenamiento + columnas configurables.
- Barra de filtros (búsqueda, fechas, estado, bodega, tipo).
- Acciones por fila (ver detalle, editar, imprimir, exportar).

### 1.2 Template: Detalle
- Cabecera con estado (Borrador/Finalizado/Anulado), auditoría (creado por/fecha).
- Tabs: “Resumen”, “Items”, “Pagos/Asientos”, “Kardex/Movimientos” (si aplica), “Audit log”.
- Acciones: Finalizar, Anular/Reversar, Reimprimir, Exportar.

### 1.3 Template: Formulario (crear/editar)
- React Hook Form + Zod.
- Validación cliente/servidor.
- Guardado incremental (draft) y confirmación para acciones críticas.

### 1.4 Template: Reporte
- Parámetros (fecha desde/hasta, bodega, producto, grupo, proveedor/cliente).
- Tabla + totales + gráficos (Recharts) cuando tenga sentido.
- Exportación: PDF + Excel (mínimo CSV si se prioriza).

### 1.5 Template: PDF / Print
- PDF “formal” (react-pdf) para archivo.
- Print HTML para impresión rápida.
- Debe incluir: empresa, datos del documento, items, totales, referencias, trazabilidad mínima.

---

## 2) Backlog integral por módulos (módulos, lógicas y templates)

> Prioridades: **P0** (bloqueante/contable/seguridad), **P1** (operación diaria), **P2** (mejora/optimización).

### 2.1 Seguridad, autenticación y permisos (P0)
**Objetivo**: sacar el sistema de “API key pública” y tener control real por usuario/rol.

**Lógicas**
- Hashing de passwords (bcrypt).
- JWT con expiración + refresh strategy (o sessions en DB).
- Protección de rutas (middleware o wrapper por layout).
- Autorización por `accessLevel` en **server actions** y servicios.
- Auditoría de acciones sensibles (finalizar/anular/ajustar stock).

**Templates/UI**
- Página `/login`.
- “Session Provider” global (layout) + logout.
- Pantalla “User Security” (rotación de tokens, sesiones activas, etc.).

**Entregables sugeridos**
- `src/app/login/page.tsx`
- `src/components/auth/*` (LoginForm, ProtectedRoute, SessionProvider)
- `src/actions/auth/*` (login/logout/validate)

---

### 2.2 Migración y bootstrap de datos (P0)
**Objetivo**: levantar ambiente con datos reales y consistentes.

**Lógicas**
- Script de migración desde `src/lib/data/*.json`.
- Orden de inserción (respetando relaciones y contadores).
- Reconciliación inicial:
  - Cargar Stock
  - Generar Kardex inicial (opcional pero recomendado para auditoría)
- Validación post-migración (conteos, totales, integridad).

**Templates/UI**
- Página administrativa “Migración/Diagnóstico” (solo admins) con checks:
  - Productos, bodegas, stock, docs, kardex.

---

### 2.3 Maestros (Company / Warehouses / Taxes / Currency / Countries / Payment Types) (P0–P1)
**Objetivo**: todo lo que el sistema necesita para operar debe ser editable.

**Lógicas**
- CRUD completo de:
  - Company
  - Warehouse
  - Tax
  - Currency
  - Country
  - PaymentType
  - DocumentCategory + DocumentType
  - ApplicationSettings (p.ej. `allowNegativeStock`, defaults)
- Validaciones: nombres únicos, códigos, estados habilitado/deshabilitado.
- Permisos: solo admin/master.

**Templates/UI**
- Listas + formularios (modal o page).
- “Settings hub” en `/settings` que enlace a submódulos.

---

### 2.4 Partners (Clientes/Proveedores) (P1)
**Objetivo**: operar compras/ventas con terceros.

**Lógicas**
- CRUD Customer con flags `isSupplier`/`isCustomer`.
- Condiciones de crédito: `dueDatePeriod`, bloqueo por morosidad (si aplica).
- Historial:
  - Documentos asociados
  - Pagos asociados
- Validación de NIT/TaxNumber (formato y duplicados).

**Templates/UI**
- `/partners` (lista + filtros)
- `/partners/manage` (editor completo)
- Template “Partner Detail” con tabs (docs/pagos).

---

### 2.5 Productos (P1)
**Objetivo**: catálogo robusto, con costos, barcodes, impuestos y control.

**Lógicas**
- CRUD Producto (campos completos + relaciones obligatorias).
- Barcodes (uno a muchos) con validación de unicidad.
- ProductGroup jerárquico.
- ProductTax y configuración de impuesto por producto.
- Precios por moneda / listas de precios (si aplica con `/price-lists`).
- “Service items” no postean stock/kardex.

**Templates/UI**
- Lista de productos con búsqueda, filtros por grupo, habilitado.
- Detalle producto:
  - Stock por bodega
  - Kardex del producto
  - Impuestos
  - Barcodes
- Importación masiva (CSV/JSON) + validación y preview.

---

### 2.6 Stock (P0–P1)
**Objetivo**: control por bodega, ajustes, y movimientos internos.

**Lógicas**
- Vista stock por bodega y por producto.
- Ajustes de stock (ya existe base):
  - motivo, usuario, fecha
  - crea Kardex AJUSTE
- Transferencias entre bodegas (P0 para multi-warehouse real):
  - SALIDA bodega origen + ENTRADA bodega destino
  - vínculo entre ambos movimientos (misma transacción)
  - validación de stock (si no permite negativo)
- Alertas de stock bajo basado en `StockControl`.

**Templates/UI**
- `/stock` como dashboard de inventario:
  - filtro bodega
  - tabla productos con existencias
  - acciones: ajustar, transferir
- Template “Stock Movement Wizard” para transferencias.

---

### 2.7 Documentos (Compras/Ventas/Devoluciones/Ajustes/Conteos/Proformas) (P0)
**Objetivo**: corazón operativo y contable del sistema.

**Lógicas mínimas por documento**
- Estados: borrador → finalizado; y flujo de anulación/reverso.
- Idempotencia: no duplicar posting.
- Numeración por tipo/bodega/mes.
- Cálculo:
  - impuestos
  - descuentos
  - totales
  - liquidación (flete por línea, costo final, margen)
- Posting:
  - Actualiza Stock (por bodega)
  - Crea Kardex (ENTRADA/SALIDA) con trazabilidad a `documentId` + `documentItemId`
  - Costeo “último costo” (con fallback a última ENTRADA en Kardex)
- Reglas:
  - bloquear finalize si faltan datos obligatorios
  - validar stock disponible en SALIDAS cuando `allowNegativeStock=false`

**Lógicas avanzadas (P1)**
- Cancelación/Anulación:
  - opción A: “reversal document” (recomendado) que crea contramovimientos
  - opción B: rollback (riesgoso si ya hay dependencias)
- Documentos de conteo (InventoryCount):
  - genera ajustes por diferencias
- Devoluciones:
  - vincular a documento origen
  - precios/costos heredados
- Auditoría:
  - quién editó qué, cuándo

**Templates/UI**
- `/documents` lista con filtros (tipo/estado/fecha/bodega/partner).
- `/documents/new` wizard:
  - seleccionar tipo
  - partner
  - items (buscador productos)
  - totales/impuestos
  - guardar borrador
  - finalizar
- `/documents/[id]/print` (HTML) y `/documents/[id]/pdf` (react-pdf).
- Template de “Document Detail” con tabs y acción “Ver Kardex relacionado”.

**Templates PDF/Print requeridos**
- Al menos por `printTemplate`:
  - Purchase
  - Invoice / Sales
  - Refund
  - LossAndDamage
  - InventoryCount
  - Proforma
  - StockReturn

---

### 2.8 Kardex (P0)
**Objetivo**: auditoría y trazabilidad completa por producto/bodega/documento.

**Lógicas**
- Listado global con filtros (producto, bodega, tipo, rango fechas).
- Kardex por producto (historial completo) con balance y costos.
- Trazabilidad:
  - link Kardex → Documento PDF/Print
  - mostrar `documentItemId` y producto
- Reportes:
  - movimientos por producto
  - rotación
  - valorización por bodega

**Templates/UI**
- `/kardex` (ya existe base): reforzar export, detalle, y “kardex por producto”.
- `/kardex/product/[productId]` (pendiente).
- `/kardex/valuation` (pendiente) con filtros por bodega/grupo.

---

### 2.9 Caja y pagos (P1)
**Objetivo**: registrar pagos, cierres, y reportes operativos.

**Lógicas**
- StartingCash / apertura de caja.
- Payments vinculados a documentos (facturas/ventas/compra si aplica).
- PaymentType.
- ZReport (cierre diario): totales por método, usuario, fecha.
- Reglas:
  - no permitir pagos sobre documentos no finalizados
  - control de cambios/anulación de pagos (auditoría)

**Templates/UI**
- `/payment-methods` + CRUD.
- `/reports` / `/reporting` para reportes de caja.

---

### 2.10 Reporting / Analytics (P1–P2)
**Objetivo**: reportes de gestión (valor, margen, impuestos, rotación).

**Reportes mínimos**
- Valorización de inventario (último costo) por bodega.
- Margen por documento / por producto / por período.
- Kardex por rango de fechas.
- Ventas por cliente / compras por proveedor.
- Impuestos (IVA) por período.

**Templates/UI**
- “Reporte template” estándar (parámetros → tabla → totales → export).
- PDF para reportes críticos (valorización, kardex).

---

### 2.11 Auditoría y cierres (P1)
**Objetivo**: asegurar integridad contable en el tiempo.

**Lógicas**
- AuditLog: registrar cambios sensibles (documentos, stock, pagos, settings).
- Cierre de período (mensual):
  - bloquear edición/finalización retroactiva (o requerir rol master)
  - snapshot de valorización
- Reproceso controlado (recalc) en caso de correcciones.

**Templates/UI**
- Página de auditoría con filtros por usuario/tabla/fecha.
- Página de cierres (periodos) con acciones controladas.

---

## 3) Mapa de módulos faltantes (vs. estado real del repo)

### Faltantes/pendientes evidentes (P0)
- `/login` y protección real de rutas.
- Dashboard dedicado (en docs se menciona `/dashboard`, pero no aparece como ruta actual).
- Módulos de configuración con CRUD completos (settings subpages).
- Transferencias entre bodegas.
- Anulación/reverso de documentos.
- Reportes PDF/Excel (más allá de PDF/Print de documentos).

### Parcialmente implementados (P1)
- Productos: existen acciones/servicios, pero falta “producto detail” estándar.
- Partners: editor existe; falta “partner detail” con historial.
- Kardex: UI base existe; faltan sub-rutas de producto/valorización.

---

## 4) Orden recomendado de implementación (hitos)

### Hito A (P0): Seguridad + sesión + permisos
- Login, session provider, protected routes.
- Enforce `accessLevel` en actions/services.

### Hito B (P0): Documentos + Stock + Kardex “cerrados”
- Finalizar consistente (ya existe base)
- Transferencias + reversos
- Indexes/queries para historial por producto/bodega

### Hito C (P1): Operación diaria
- Partners completo + Productos completo
- Caja/pagos

### Hito D (P1–P2): Reportes y cierres
- Valorización, margen, IVA, rotación
- Audit log + cierres

---

## 5) Checklist de definición por cada módulo (para no olvidar nada)

Para cada módulo nuevo o refactor:
- Datos: modelos involucrados + índices.
- Acciones: list/get/create/update/delete.
- Servicios: reglas de negocio (validaciones, cálculos, idempotencia).
- UI templates: lista, detalle, formulario, reportes, pdf/print.
- Permisos: roles y restricciones.
- Auditoría: qué se loguea.
- Performance: paginación y evitar N+1.

---

## 6) Nota importante: exclusión del módulo etiquetas
- No agregar tareas relacionadas con `/print-label` o `/print-labels`.
- No incluir BrowserPrint/ZPL.
