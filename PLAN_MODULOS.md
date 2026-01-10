# PLAN DE IMPLEMENTACIÓN DE MÓDULOS

## 📋 Servicios Implementados ✅

### 1. Autenticación (`auth-service.ts`)
- ✅ `authenticateUser()` - Valida credenciales
- ✅ `validateSession()` - Verifica sesión activa
- ✅ `logoutUser()` - Cierra sesión
- **TODO**: Implementar hash de passwords (bcrypt)
- **TODO**: JWT con expiración
- **TODO**: 2FA/MFA

### 2. Kardex (`kardex-service.ts`)
- ✅ `createKardexEntry()` - Registra movimiento
- ✅ `getProductKardexHistory()` - Historial completo
- ✅ `getKardexSummary()` - Resumen por período
- ✅ `getInventoryValuation()` - Valuación de inventario
- **TODO**: Reportes PDF
- **TODO**: Exportación a Excel
- **TODO**: Análisis de rotación

### 3. Documentos (`document-service.ts`)
- ✅ `generateDocumentNumber()` - Auto-numeración
- ✅ `createDocument()` - Crear documento con items
- ✅ `finalizeDocument()` - Finalizar y actualizar stocks/kardex
- **TODO**: Cancelación de documentos
- **TODO**: Edición con auditoría
- **TODO**: Impresión de documentos
- **TODO**: Integración con E-factura

### 4. Inventario (`inventory-service.ts`)
- ✅ `getProductDetails()` - Info completa de producto
- ✅ `searchProducts()` - Búsqueda por nombre/código/barcode
- ✅ `getLowStockAlerts()` - Alertas de stock bajo
- ✅ `getInventorySummary()` - Resumen general
- ✅ `adjustStock()` - Ajuste manual con auditoría
- **TODO**: Importación en lote
- **TODO**: Movimiento entre almacenes
- **TODO**: Auditoría de cambios de precio

---

## 🎨 Componentes a Crear

### Fase 1: Autenticación (CRÍTICA)

#### 1.1 Login Page
**Archivo**: `src/app/login/page.tsx`
```tsx
- Formulario de login
- Validación de credenciales
- Redirección a dashboard si autenticado
- Manejo de errores
```

**Componentes requeridos**:
- `src/components/auth/login-form.tsx` - Formulario
- `src/components/auth/auth-provider.tsx` - Context de autenticación
- `src/lib/auth-context.ts` - Hook useAuth()

#### 1.2 Protección de Rutas
**Archivo**: `src/components/auth/protected-route.tsx`
- Middleware para rutas protegidas
- Validación de accessLevel
- Redirect a login si no autenticado

#### 1.3 Session Provider
**Archivo**: `src/components/layout/session-provider.tsx`
- Provider global de sesión
- Actualización de lastActivityTime
- Manejo de timeout de sesión

---

### Fase 2: Dashboard Principal

**Archivo**: `src/app/dashboard/page.tsx`

**Widgets**:
- Inventario total en valor
- Productos con stock bajo (widget con alertas)
- Últimos documentos creados
- Resumen de movimientos del día
- Gráficos de rotación de inventario

**Componentes**:
- `src/components/dashboard/inventory-overview.tsx`
- `src/components/dashboard/low-stock-widget.tsx`
- `src/components/dashboard/recent-documents.tsx`
- `src/components/dashboard/movement-chart.tsx`

---

### Fase 3: Gestión de Usuarios

**Archivo**: `src/app/users/page.tsx`

**Features**:
- Listado de usuarios (tabla paginada)
- CRUD de usuarios
- Asignación de accessLevel
- Búsqueda y filtros
- Auditoría de cambios de usuario

**Componentes**:
- `src/components/users/user-list.tsx` - Tabla
- `src/components/users/user-form.tsx` - CRUD
- `src/components/users/access-level-badge.tsx`

**Servicios**:
- `src/services/user-service.ts`:
  - `createUser()`
  - `updateUser()`
  - `deleteUser()`
  - `listUsers()`

---

### Fase 4: Gestión de Productos

**Archivo**: `src/app/products/page.tsx`

**Features**:
- Listado de productos
- CRUD individual
- Importación en lote (JSON/CSV)
- Gestión de códigos y barcodes
- Asignación de grupos y taxes
- Búsqueda y filtros avanzados

**Componentes**:
- `src/components/products/product-list.tsx`
- `src/components/products/product-form.tsx`
- `src/components/products/product-import.tsx`
- `src/components/products/barcode-scanner.tsx`
- `src/components/products/stock-control.tsx`

**Servicios**:
- `src/services/product-service.ts`:
  - `createProduct()`
  - `updateProduct()`
  - `deleteProduct()`
  - `importProducts()`
  - `addBarcode()`
  - `updateStockControl()`

---

### Fase 5: Ingreso de Documentos

**Archivo**: `src/app/documents/intake/page.tsx`

**Features**:
- Creación de documentos de compra/entrada
- Selector de proveedores (Customer)
- Búsqueda y adición de items
- Cálculo automático de totales
- Aplicación de descuentos
- Cálculo de impuestos
- Vista previa antes de finalizar
- Generación automática de número
- Finalización y creación automática de Kardex

**Componentes**:
- `src/components/documents/document-form.tsx`
- `src/components/documents/item-selector.tsx`
- `src/components/documents/discount-calculator.tsx`
- `src/components/documents/tax-calculator.tsx`
- `src/components/documents/document-preview.tsx`

**Servicios**: Ya existen en `document-service.ts`

---

### Fase 6: Salida de Productos

**Archivo**: `src/app/documents/output/page.tsx`

**Features**:
- Documentos de salida (ventas, devoluciones, ajustes)
- Similar a ingreso pero con direcciones opuestas
- Control de destino (cliente/almacén)
- Validación de stock disponible

**Componentes**:
- `src/components/documents/output-form.tsx`
- `src/components/documents/stock-validation.tsx`

---

### Fase 7: Kardex (Movimientos)

**Archivo**: `src/app/kardex/page.tsx`

**Features**:
- Tabla de todos los movimientos
- Filtros: por producto, fecha, tipo, documento
- Búsqueda por número de documento
- Exportación a PDF/Excel
- Historial detallado de cambios

**Sub-módulos**:
1. **Kardex por Producto**: `src/app/kardex/product/[productId]/page.tsx`
   - Historial completo de un producto
   - Gráfico de evolución de stock
   - Valuación histórica

2. **Valuación de Inventario**: `src/app/kardex/valuation/page.tsx`
   - Reporte de inventario valorizado
   - Por almacén
   - Por grupo de productos

**Componentes**:
- `src/components/kardex/kardex-table.tsx`
- `src/components/kardex/kardex-filters.tsx`
- `src/components/kardex/product-history.tsx`
- `src/components/kardex/inventory-valuation.tsx`

**Servicios**: Ya existen en `kardex-service.ts`

---

### Fase 8: Configuración

**Archivo**: `src/app/settings/page.tsx`

**Sub-módulos**:

1. **Configuración General** (`src/app/settings/application/page.tsx`)
   - Nombre de organización
   - Logo
   - Colores/tema
   - Formato de fecha/moneda
   - Almacén por defecto
   - IVA por defecto
   - Permitir stock negativo

2. **Configuración de Almacenes** (`src/app/settings/warehouses/page.tsx`)
   - CRUD de almacenes
   - Asignación de tipos de documentos

3. **Configuración de Documentos** (`src/app/settings/documents/page.tsx`)
   - Tipos de documentos (Compra, Venta, Devolución, etc.)
   - Categorías
   - Secuencias de numeración
   - Templates de impresión

4. **Configuración de Impuestos** (`src/app/settings/taxes/page.tsx`)
   - CRUD de impuestos
   - Asignación a productos

5. **Tipos de Pago** (`src/app/settings/payment-types/page.tsx`)
   - CRUD de tipos de pago
   - Validaciones

6. **Auditoria** (`src/app/settings/audit-log/page.tsx`)
   - Tabla de cambios del sistema
   - Filtros por usuario, tabla, fecha
   - Exportación

**Componentes**:
- `src/components/settings/settings-form.tsx` (genérico)
- Múltiples formularios específicos

**Servicios**:
- `src/services/settings-service.ts`:
  - `getSettings()`
  - `updateSettings()`
  - `createWarehouses()`
  - `createDocumentTypes()`
  - etc.

---

## 🔌 Acciones Servidor (`src/actions/`)

Actualizar las acciones existentes para usar Amplify:

```
actions/
├── auth/
│   ├── login.ts
│   ├── logout.ts
│   └── validate-session.ts
├── users/
│   ├── create-user.ts
│   ├── update-user.ts
│   ├── delete-user.ts
│   └── list-users.ts
├── products/
│   ├── create-product.ts
│   ├── update-product.ts
│   ├── import-products.ts
│   └── search-products.ts
├── documents/
│   ├── create-document.ts
│   ├── finalize-document.ts
│   └── generate-number.ts
├── kardex/
│   ├── get-entries.ts
│   ├── get-history.ts
│   └── get-valuation.ts
└── inventory/
    ├── get-summary.ts
    ├── adjust-stock.ts
    └── get-alerts.ts
```

---

## 🗄️ Migración de Datos

**Archivo**: `src/lib/migrate-amplify.ts`

```typescript
// Script para:
// 1. Leer archivos JSON
// 2. Insertar en Amplify en orden correcto
// 3. Generar Kardex inicial desde Stock
// 4. Validar integridad

Orden de inserción:
1. Country
2. Currency
3. Warehouse
4. Company
5. Tax
6. PaymentType
7. DocumentCategory
8. ProductGroup
9. Product
10. Barcode
11. ProductTax
12. Customer
13. CustomerDiscount
14. LoyaltyCard
15. StockControl
16. Stock
17. User
18. Document (generar números)
19. DocumentType
20. DocumentItem
21. DocumentItemTax
22. Payment
23. Kardex (generar desde Stock)
24. PosOrder
25. StartingCash
26. ZReport
27. Counter
28. Template
29. ApplicationProperty
```

---

## 🚦 Orden de Implementación Recomendado

### Semana 1-2: Cimientos
1. ✅ Actualizar schema Amplify
2. ✅ Crear servicios base (auth, kardex, document, inventory)
3. ⚠️ Crear script de migración
4. Implementar login page
5. Implementar session provider
6. Implementar protected routes

### Semana 3: Interfaz Básica
7. Dashboard principal
8. Listado de productos (simple)
9. Búsqueda de productos

### Semana 4-5: Módulo de Productos
10. CRUD de productos
11. Gestión de barcodes
12. Importación en lote
13. Stock control

### Semana 6-7: Módulo de Documentos
14. Ingreso de documentos
15. Salida de productos
16. Finalización automática

### Semana 8-9: Kardex
17. Vista de Kardex general
18. Kardex por producto
19. Valuación de inventario
20. Reportes

### Semana 10: Configuración
21. Módulo de configuración
22. Gestión de usuarios
23. Auditoria

### Semana 11-12: Pulido
24. Reportes PDF/Excel
25. Optimización de performance
26. Testing
27. Documentación

---

## 📊 Dependencias entre Módulos

```
Login → Dashboard → [Productos → Documentos → Kardex]
         ↓
    Configuración
         ↓
      Usuarios
```

**Críticos** (bloquean otros):
- Login
- Migración de datos
- Estructura de Amplify

---

## 🎯 Recomendaciones Finales

1. **Hash de Passwords**: Implementar bcrypt inmediatamente
2. **JWT**: Cambiar session tokens por JWT con expiración
3. **Auditoría**: Crear AuditLog en cada cambio importante
4. **Validación**: Implementar validaciones en acciones server
5. **Caché**: Usar React Query para queries frecuentes
6. **Testing**: Tests unitarios de servicios críticos
7. **Documentación**: Mantener actualizada con cambios
8. **Backup**: Plan de backup de DynamoDB

