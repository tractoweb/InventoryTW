# Plan Completo: Gestión de Productos Deshabilitados, Duplicados y Trazabilidad

**Fecha:** Junio 10, 2026  
**Estado:** Listo para implementar (100% Seguro - Cambios únicamente aditivos)  
**Prioridad:** ALTA - Impacta directamente en inventario y reportes

---

## 📋 Tabla de Contenidos
1. [Contexto del Problema](#contexto-del-problema)
2. [Confirmación de Seguridad de BD](#confirmación-de-seguridad-de-bd)
3. [Arquitectura de Solución](#arquitectura-de-solución)
4. [Modelos de Datos (Amplify)](#modelos-de-datos-amplify)
5. [Servicios y Acciones](#servicios-y-acciones)
6. [Filtros Complejos (UI)](#filtros-complejos-ui)
7. [Gestión de Duplicados](#gestión-de-duplicados)
8. [Análisis: Eliminación Total de Productos](#análisis-eliminación-total-de-productos)
9. [Implementación por Fases](#implementación-por-fases)

---

## 🔴 Contexto del Problema

### Síntomas Actuales
- **Tabla productos (UI):** ~3,790 productos visibles
- **Base de datos real:** Más productos (desconocidos, deshabilitados, eliminados)
- **Falta de visibilidad:** No hay filtros para ver deshabilitados/eliminados
- **Pérdida de datos:** Posibilidad de duplicados sin control
- **Sin trazabilidad:** No se registra cuándo/por qué se deshabilitó

### Causas Raíz
1. Campo `isEnabled: boolean` (hard delete conceptual, no es real soft delete)
2. No hay registro de cuándo/por qué se deshabilita
3. No hay gestión de duplicados automática
4. Sin interfaz para filtrar deshabilitados/eliminados
5. Riesgo: Usuario presiona "desactivado" por accidente durante creación

---

## 🟢 Confirmación de Seguridad de BD

### ✅ Cambios en `resource.ts` (100% SEGUROS)

**Lo que YA EXISTE en tu schema (verificado):**

```typescript
// 1. CAMPOS EN PRODUCT (aditivos, no modifican PK)
Product: a.model({
  idProduct: a.integer().required(),  // PK - SIN CAMBIOS
  // ... otros campos ...
  isEnabled: a.boolean().default(true),  // EXISTENTE
  disabledReason: a.string(),            // ✅ NUEVO (aditivo)
  disabledAt: a.datetime(),              // ✅ NUEVO (aditivo)
  lastEnabledAt: a.datetime(),           // ✅ NUEVO (aditivo)
  mergedIntoProductId: a.integer(),      // ✅ NUEVO (aditivo)
  duplicateGroupId: a.integer(),         // ✅ NUEVO (aditivo)
  disabledHistories: a.hasMany('DisabledEntityHistory', 'entityId'),  // ✅ NUEVO (relación)
})

// 2. NUEVAS TABLAS (100% seguro)
DisabledEntityHistory  // ✅ Nueva tabla
ProductDuplicateCandidate  // ✅ Nueva tabla
ProductMergeHistory  // ✅ Nueva tabla

// 3. CAMPOS EN AUDITLOG (aditivos)
reason: a.string()                 // ✅ NUEVO
relatedRecords: a.string()         // ✅ NUEVO
impactedDocuments: a.integer()     // ✅ NUEVO
```

### 🟢 Por qué es 100% Seguro:
- ✅ No se modifican **llaves primarias** de tablas existentes
- ✅ Solo se **agregan campos** (nullable por defecto)
- ✅ Datos existentes **NO se pierden**
- ✅ Registros antiguos seguirán funcionando (nuevos campos = null)
- ✅ Las **relaciones nuevas** no afectan datos existentes

### ⚠️ Verificación antes de Push:
```bash
# Cuando hagas amplify push, busca en el diff:
# Product: Update  (NO "Replace" o "Delete")
# DisabledEntityHistory: Create
# ProductDuplicateCandidate: Create
# ProductMergeHistory: Create
```

---

## 🏗️ Arquitectura de Solución

```
┌─────────────────────────────────────────────────────────────┐
│                     MAESTRO PRODUCTOS                        │
├─────────────────────────────────────────────────────────────┤
│  Filtros Complejos:                                          │
│  • Habilitados / Deshabilitados / Todos                      │
│  • Rango de Fecha (cuándo se deshabilitó)                    │
│  • Motivo (Duplicado, Accidental, Obsoleto, etc.)           │
│  • Búsqueda: Nombre, Código, PLU, Barcode                   │
│  • Stock: Con stock / Sin stock / Negativo                  │
│  • Grupo de Producto                                         │
│  • Historial de Cambios (timeline)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │      Servicios y Acciones           │
        ├─────────────────────────────────────┤
        │ • disable-product                   │
        │ • enable-product                    │
        │ • detect-duplicate-products         │
        │ • merge-products                    │
        │ • audit-log                         │
        │ • get-product-history               │
        │ • validate-merge                    │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │      Datos (Amplify/DynamoDB)       │
        ├─────────────────────────────────────┤
        │ • Product (modificado)              │
        │ • DisabledEntityHistory (nuevo)     │
        │ • ProductDuplicateCandidate (nuevo) │
        │ • ProductMergeHistory (nuevo)       │
        │ • AuditLog (modificado)             │
        └─────────────────────────────────────┘
```

---

## 💾 Modelos de Datos (Amplify)

### 1. Campos en `Product` (YA EXISTEN)

```typescript
Product: a.model({
  idProduct: a.integer().required(),
  name: a.string().required(),
  code: a.string(),
  isEnabled: a.boolean().default(true),           // Existente
  
  // Nuevos campos de deshabilitación:
  disabledReason: a.string(),                     // "Accidental" | "Duplicate" | "Obsolete" | "Temporary" | "MERGED_WITH_PRIMARY"
  disabledAt: a.datetime(),                       // Cuándo se deshabilitó
  lastEnabledAt: a.datetime(),                    // Última vez que estuvo activo
  mergedIntoProductId: a.integer(),               // Si fue merged, a cuál ID
  duplicateGroupId: a.integer(),                  // Agrupa duplicados confirmados
  
  // Relación a historial
  disabledHistories: a.hasMany('DisabledEntityHistory', 'entityId'),
})
```

### 2. `DisabledEntityHistory` (NUEVA TABLA)

```typescript
DisabledEntityHistory: a.model({
  historyId: a.id().required(),
  entityType: a.string().required(),              // "Product" | "Document" | "User" | "Customer"
  entityId: a.integer().required(),
  reason: a.string(),                             // Por qué se deshabilitó
  disabledBy: a.integer().required(),             // userId
  disabledAt: a.datetime().required(),
  reenabledBy: a.integer(),
  reenabledAt: a.datetime(),
  reenableReason: a.string(),                     // "Was accidental" | "Needed again" | "Fixed"
  tags: a.string().array(),                       // ["ACCIDENTAL", "DUPLICATED", ...]
  notes: a.string(),
})
// Índices: byEntityType, byEntityId, byDisabledAt
```

### 3. `ProductDuplicateCandidate` (NUEVA TABLA)

```typescript
ProductDuplicateCandidate: a.model({
  candidateId: a.id().required(),
  primaryProductId: a.integer().required(),       // Producto a mantener
  duplicateProductId: a.integer().required(),     // Producto duplicado
  matchType: a.string().required(),               // "EXACT_CODE" | "EXACT_NAME" | "FUZZY_NAME" | "BARCODE"
  confidence: a.float(),                          // 0.0 - 1.0 (ej: 0.95 = 95%)
  detectedAt: a.datetime().required(),
  detectedBy: a.string(),                         // "SYSTEM" o userId
  status: a.string().default('PENDING'),          // "PENDING" | "CONFIRMED" | "REJECTED" | "MERGED"
  reason: a.string(),
  notes: a.string(),
})
// Índices: byPrimaryProductId, byDuplicateProductId, byStatus, byConfidence
```

### 4. `ProductMergeHistory` (NUEVA TABLA)

```typescript
ProductMergeHistory: a.model({
  mergeId: a.id().required(),
  primaryProductId: a.integer().required(),
  duplicateProductId: a.integer().required(),
  mergedBy: a.integer().required(),               // userId
  mergedAt: a.datetime().required(),
  barcodesMerged: a.integer().default(0),         // Cuántos barcodes se fusionaron
  commentsMerged: a.integer().default(0),
  stockControlsMerged: a.integer().default(0),
  notes: a.string(),
  reversible: a.boolean().default(false),         // Si se puede deshacer
})
// Índices: byPrimaryProductId, byDuplicateProductId
```

### 5. `AuditLog` (MODIFICADO - añadidos campos)

```typescript
AuditLog: a.model({
  logId: a.id().required(),
  userId: a.integer().required(),
  action: a.string().required(),                  // "CREATED" | "UPDATED" | "DISABLED" | "MERGED"
  tableName: a.string().required(),               // "Product" | "Document" | etc.
  recordId: a.integer().required(),
  oldValues: a.string(),                          // JSON serializado
  newValues: a.string(),                          // JSON serializado
  timestamp: a.datetime().required(),
  
  // Nuevos campos:
  reason: a.string(),                             // Contexto adicional
  relatedRecords: a.string(),                     // JSON: referencias a otros registros
  impactedDocuments: a.integer(),                 // Cuántos documentos afectados
})
```

---

## 🛠️ Servicios y Acciones

### 1. `disable-product.ts` (Action)

**Propósito:** Deshabilitar un producto con trazabilidad.

```typescript
// src/actions/disable-product.ts
export async function disableProduct(
  productId: number,
  reason: 'Accidental' | 'Duplicate' | 'Obsolete' | 'Temporary',
  notes?: string,
  userId?: number
): Promise<{ success: boolean; message: string }> {
  // 1. Validar que el producto existe y está habilitado
  // 2. Registrar en DisabledEntityHistory
  // 3. Actualizar Product: isEnabled=false, disabledAt=now, disabledReason
  // 4. Registrar en AuditLog
  // 5. Si reason="Duplicate": crear ProductDuplicateCandidate (si no existe)
  // 6. Retornar éxito
}
```

**Flujo:**
1. Usuario click "Deshabilitar" en maestro productos
2. Aparece modal con opciones: Motivo (select), Notas (textarea)
3. Se ejecuta `disableProduct()`
4. Se registra en `DisabledEntityHistory`
5. Se actualiza `Product.isEnabled = false`
6. Se crea entrada en `AuditLog`
7. Retorna confirmación

### 2. `enable-product.ts` (Action)

**Propósito:** Reabilitar un producto deshabilitado.

```typescript
export async function enableProduct(
  productId: number,
  reason?: string,
  userId?: number
): Promise<{ success: boolean; message: string }> {
  // 1. Validar que el producto existe y está deshabilitado
  // 2. Validar: Si fue merged, advertir al usuario
  // 3. Registrar "reenablement" en DisabledEntityHistory
  // 4. Actualizar Product: isEnabled=true, lastEnabledAt=now
  // 5. Registrar en AuditLog
  // 6. Retornar éxito
}
```

**Alertas importantes:**
- ⚠️ Si `mergedIntoProductId !== null`: Mostrar "Este producto fue fusionado con {primaryId}. ¿Deseas reactivarlo de todas formas?"
- ✅ Registrar razón de reactivación en `DisabledEntityHistory.reenableReason`

### 3. `detect-duplicate-products.ts` (Service)

**Propósito:** Identificar automáticamente duplicados (batch).

```typescript
export async function detectDuplicateProducts(): Promise<{
  exactCodeMatches: ProductDuplicateCandidate[];
  exactNameMatches: ProductDuplicateCandidate[];
  fuzzyMatches: ProductDuplicateCandidate[];
}> {
  // 1. Obtener todos los productos habilitados
  // 2. Agrupar por: CÓDIGO exacto, NOMBRE exacto, NOMBRE similar (levenshtein)
  // 3. Para cada grupo con 2+ productos:
  //    - Calcular confidence (0.0 - 1.0)
  //    - Crear ProductDuplicateCandidate con status="PENDING"
  // 4. Retornar candidatos detectados
}
```

**Algoritmos:**
- **EXACT_CODE:** Productos con el mismo `code` (case-insensitive)
- **EXACT_NAME:** Productos con el mismo `name` (case-insensitive)
- **FUZZY_NAME:** Distancia Levenshtein < 3 caracteres (80%+ similitud)
- **BARCODE:** Usar `Barcode` table (si múltiples productos comparten barcode)

**Confidence:**
- EXACT_CODE: 0.99 (99% probable duplicado)
- EXACT_NAME: 0.95 (95% probable)
- FUZZY_NAME: 0.75 (75% probable)
- BARCODE: 0.98 (98% probable)

### 4. `merge-products.ts` (Action)

**Propósito:** Fusionar dos productos (primary + duplicate).

```typescript
export async function mergeProducts(
  primaryProductId: number,
  duplicateProductId: number,
  userId?: number
): Promise<{ success: boolean; message: string; impactedDocuments: number }> {
  // TRANSACCIÓN (debe ser atómica):
  // 1. Validar que ambos productos existen
  // 2. Validar que no han sido ya merged
  // 3. Preparar merge plan (ver árbol de cambios)
  // 4. Ejecutar cambios en orden:
  //    a) Fusionar barcodes: Barcode.productId = primaryProductId
  //    b) Redirigir kardex: Kardex.productId = primaryProductId
  //    c) Redirigir stocks: Stock.productId = primaryProductId
  //    d) Redirigir documentos: DocumentItem.productId = primaryProductId
  //    e) Redirigir comentarios: ProductComment.productId = primaryProductId
  //    f) Deshabilitar producto duplicate: Product.isEnabled=false, mergedIntoProductId=primaryProductId
  // 5. Registrar en ProductMergeHistory
  // 6. Actualizar ProductDuplicateCandidate.status = "MERGED"
  // 7. Registrar en AuditLog (con relatedRecords=documentos impactados)
  // 8. Retornar conteo de cambios
}
```

**Árbol de cambios (qué se fusiona):**

```
MERGE primaryId=10, duplicateId=15

Barcodes:
  FROM: Barcode.productId = 15
  TO:   Barcode.productId = 10
  COUNT: 3 barcodes

Kardex:
  FROM: Kardex.productId = 15
  TO:   Kardex.productId = 10
  COUNT: 47 entradas

Stock:
  FROM: Stock.productId = 15
  TO:   Stock.productId = 10
  COUNT: 2 warehouses

DocumentItems:
  FROM: DocumentItem.productId = 15
  TO:   DocumentItem.productId = 10
  COUNT: 23 documentos afectados
  ACTION: Actualizar kardex asociado

ProductComments:
  FROM: ProductComment.productId = 15
  TO:   ProductComment.productId = 10
  COUNT: 2 comentarios

Resultado final:
  Product[10]: isEnabled=true (sin cambios)
  Product[15]: isEnabled=false, mergedIntoProductId=10
  ProductMergeHistory: Crear registro de merge
```

### 5. `get-product-history.ts` (Action)

**Propósito:** Obtener historial completo de un producto.

```typescript
export async function getProductHistory(productId: number): Promise<{
  product: Product;
  disabledHistory: DisabledEntityHistory[];
  mergeHistory: ProductMergeHistory | null;
  auditLog: AuditLog[];
  duplicateCandidates: ProductDuplicateCandidate[];
}> {
  // Obtener:
  // 1. Datos del producto actual
  // 2. Todas las entradas en DisabledEntityHistory (habilitaciones/deshabilitaciones)
  // 3. Si mergeHistory existe: obtener fusión
  // 4. AuditLog.recordId = productId (cambios)
  // 5. ProductDuplicateCandidate donde primary o duplicate = productId
}
```

### 6. `validate-merge.ts` (Service)

**Propósito:** Validar que una fusión es segura antes de ejecutarla.

```typescript
export async function validateMerge(
  primaryProductId: number,
  duplicateProductId: number
): Promise<{
  canMerge: boolean;
  warnings: string[];
  conflicts: string[];
  summary: {
    barcodeConflicts: number;
    stockDiscrepancies: number;
    documentImpact: number;
  };
}> {
  // Validaciones:
  // 1. ¿Ambos productos existen?
  // 2. ¿Tienen códigos/nombres conflictivos? (advertencia)
  // 3. ¿Hay diferencias de precios? (advertencia)
  // 4. ¿Cuántos documentos se verán afectados?
  // 5. ¿Hay barcodes duplicados entre ambos? (conflicto)
  // 6. ¿Las cantidades de stock son similares? (advertencia si muy diferentes)
}
```

---

## 🎨 Filtros Complejos (UI)

### Maestro Productos - Nueva Interfaz Filtros

#### Layout Propuesto:

```
┌─ MAESTRO PRODUCTOS ────────────────────────────────────────────┐
│                                                                  │
│ [Mostrar] [Habilitados ▼] [Filtros Avanzados ▼]  [Search...]   │
│                                                                  │
│ ┌─ Filtros Avanzados ───────────────────────────────────────┐   │
│ │                                                             │   │
│ │  Estado:                                                    │   │
│ │  ☐ Habilitados   ☐ Deshabilitados   ☐ Todos               │   │
│ │  ☐ Mostrar solo eliminados accidentalmente                 │   │
│ │  ☐ Mostrar solo duplicados                                 │   │
│ │  ☐ Mostrar solo obsoletos                                  │   │
│ │                                                             │   │
│ │  Rango de Deshabilitación:                                 │   │
│ │  [Desde: DD/MM/YYYY] [Hasta: DD/MM/YYYY]                  │   │
│ │                                                             │   │
│ │  Stock:                                                     │   │
│ │  ☐ Con stock   ☐ Sin stock   ☐ Stock negativo             │   │
│ │                                                             │   │
│ │  Grupo de Producto: [Seleccionar grupo ▼]                 │   │
│ │                                                             │   │
│ │  Búsqueda:                                                  │   │
│ │  [Nombre o código...]                                      │   │
│ │                                                             │   │
│ │  Otras opciones:                                            │   │
│ │  ☐ Mostrar candidatos a duplicado                          │   │
│ │  ☐ Mostrar histórico de cambios                            │   │
│ │                                                             │   │
│ │  [Aplicar Filtros] [Limpiar]                              │   │
│ │                                                             │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─ Resultados (3790 / 4200) ────────────────────────────────┐   │
│ │                                                             │   │
│ │ Código | Nombre | Estado | Motivo | Deshabilitado | Stock │   │
│ │────────────────────────────────────────────────────────────│   │
│ │ P001   │ Producto 1 │ ✅ │ - │ - │ 150 un │ [...] │   │
│ │ P002   │ Producto 2 │ ❌ │ Duplicado │ 2025-06-01 │ 0 un │ [...]   │
│ │        │            │   │ ⚠️ Merged into P001 │                 │
│ │                                                             │   │
│ │ [Ver Historial] [Reabilitar] [Fusionar con...] [Editar]  │   │
│ │                                                             │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Filtros Principales:

| Filtro | Tipo | Opciones | Default |
|--------|------|----------|---------|
| **Estado** | Checkbox | Habilitados, Deshabilitados, Todos | Habilitados |
| **Motivo** | Multi-Select | Accidental, Duplicate, Obsolete, Temporary, Merged | Todos |
| **Rango Fecha** | Date Range | Desde/Hasta (cuándo se deshabilitó) | Últimos 30 días |
| **Stock** | Checkbox | Con stock, Sin stock, Negativo | Todos |
| **Grupo** | Dropdown | (dinámico de ProductGroup) | Todos |
| **Búsqueda** | Text | Nombre, Código, PLU, Barcode | - |
| **Candidatos** | Checkbox | Mostrar solo candidatos a duplicado | OFF |
| **Historial** | Checkbox | Mostrar timeline de cambios | OFF |

#### Query GraphQL Resultante:

```graphql
query ListProductsFiltered($filters: ProductFilterInput!) {
  listProducts(filter: $filters) {
    items {
      idProduct
      name
      code
      isEnabled
      disabledReason
      disabledAt
      mergedIntoProductId
      duplicateGroupId
      stock {
        quantity
      }
      disabledHistories {
        reason
        disabledBy
        disabledAt
        reenableReason
        reenabledAt
      }
    }
    total
  }
}
```

#### Acciones en cada Fila:

```
┌─ Producto Habilitado ─────────────────────┐
│ [Ver Historial] [Editar] [Deshabilitar]   │
│                                             │
│ Si hay candidatos a duplicado:             │
│ ⚠️ [Revisar Candidato Duplicado]           │
└─────────────────────────────────────────────┘

┌─ Producto Deshabilitado ──────────────────┐
│ Motivo: Duplicado                         │
│ Deshabilitado: 2025-06-01 por Juan        │
│                                             │
│ [Ver Historial] [Reabilitar] [Editar]     │
│                                             │
│ Si mergedIntoProductId:                   │
│ ⚠️ Fusionado con P001 el 2025-06-02       │
└─────────────────────────────────────────────┘
```

---

## 🔍 Gestión de Duplicados

### Proceso de Detección y Resolución

```
1. DETECCIÓN AUTOMÁTICA
   └─ Ejecutar: detectDuplicateProducts()
      └─ Crear ProductDuplicateCandidate (status="PENDING")
         └─ Mostrar en Dashboard/Notificaciones

2. VALIDACIÓN MANUAL (Usuario)
   └─ Ir a: Maestro Productos → Candidatos a Duplicado
      └─ Revisar cada candidato:
         ┌─ RECHAZAR (status="REJECTED")
         │  └─ Anotar motivo: "No son duplicados"
         │
         └─ CONFIRMAR (status="CONFIRMED")
            └─ Ir a: Paso 3

3. FUSIÓN (Merge)
   └─ Ejecutar: mergeProducts(primary=10, duplicate=15)
      ├─ Validar: validateMerge()
      ├─ Mostrar resumen de cambios
      ├─ Pedir confirmación
      └─ Ejecutar cambios (transacción):
         ├─ Fusionar barcodes
         ├─ Redirigir kardex
         ├─ Redirigir documentos
         ├─ Deshabilitar producto duplicate
         └─ Registrar en ProductMergeHistory

4. VERIFICACIÓN
   └─ Confirmar que:
      ├─ ProductMergeHistory creado
      ├─ Product[15].mergedIntoProductId = 10
      ├─ Todos los documentos redirigidos
      └─ AuditLog registrado
```

### Panel de Duplicados (Nueva Interfaz)

```
┌─ Gestión de Duplicados ─────────────────────────────────────┐
│                                                               │
│ Total Candidatos: 47  [Pendientes: 32] [Confirmados: 10]    │
│ Fusionados: 5         [Rechazados: 3]                        │
│                                                               │
│ [Ejecutar Detección] [Ver Histórico de Merges]              │
│                                                               │
│ ┌─ PENDIENTES (32) ────────────────────────────────────┐    │
│ │                                                       │    │
│ │ Conf. │ Tipo │ Primary │ Duplicate │ Motivo │ Acción │    │
│ │───────────────────────────────────────────────────────│    │
│ │ 0.99  │CODE  │ P001    │ P002      │ Código │ ✓ ✗    │    │
│ │       │ Exact Match: PRD-123      │       │    │    │
│ │ 0.95  │NAME  │ P003    │ P004      │ Nombre │ ✓ ✗    │    │
│ │ 0.87  │BARCODE│ P005   │ P006      │ Code  │ ✓ ✗    │    │
│ │                                                       │    │
│ │ [✓ Confirmar] [✗ Rechazar]                           │    │
│ │                                                       │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ ┌─ CONFIRMADOS (10) ────────────────────────────────────┐    │
│ │                                                       │    │
│ │ Primary │ Duplicate │ Stock Combinado │ Acción       │    │
│ │─────────────────────────────────────────────────────│    │
│ │ P001    │ P002      │ 150 un         │ [Fusionar]   │    │
│ │ P003    │ P004      │ 300 un         │ [Fusionar]   │    │
│ │                                                       │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Análisis: Eliminación Total de Productos

### Propuesta: "HARD DELETE" con Cascada

**Pregunta:** ¿Por qué NO deberíamos hacer hard delete completo (borrar el producto y todo su historial)?

### Consecuencias de Hard Delete:

#### 1️⃣ **Pérdida de Auditoria Fiscal**
```
Escenario: Usuario crea producto P001 accidentalmente
- Con SOFT DELETE (recomendado):
  ✅ P001 sigue existiendo (isEnabled=false)
  ✅ DisabledEntityHistory registra quién/cuándo
  ✅ Auditoría puede demostrar: "Existió, se deshabilitó"

- Con HARD DELETE:
  ❌ P001 desaparece completamente
  ❌ Auditor pregunta: "¿Existió alguna vez?"
  ❌ Sin prueba = riesgo fiscal
```

#### 2️⃣ **Rotura de Documentos**
```
Escenario: Documento D001 tiene Línea con P001

Con SOFT DELETE:
  ✅ DocumentItem.productId = P001 (válido, pero inactivo)
  ✅ Puedo generar reporte: "Qué productos se vendieron"

Con HARD DELETE:
  ❌ DocumentItem.productId = 1 (apunta a null/vacío)
  ❌ Reporte se rompe: "¿Qué producto se vendió aquí?"
  ❌ Preguntas del cliente: "¿Qué me vendieron?"
```

#### 3️⃣ **Inconsistencia de Kardex**
```
Escenario: Producto P001 tiene 50 entradas en Kardex

Con SOFT DELETE:
  ✅ Kardex.productId sigue válido
  ✅ Puedo auditar stock histórico

Con HARD DELETE:
  ❌ Kardex se queda "huérfano" (productId inválido)
  ❌ No puedo reconocer el historial
```

#### 4️⃣ **Problema de Duplicados en Cascada**
```
Escenario: Intentas borrar P001, pero hay P002 (duplicado/merged)

Query: ¿Cuáles productos fueron merged?
SOFT DELETE:
  ✅ SELECT * FROM Product WHERE mergedIntoProductId = 1
  ✅ Resultado: P002

HARD DELETE:
  ❌ mergedIntoProductId no existe
  ❌ Pierdo referencia: ¿Con quién se fusionó P002?
```

### 🎯 Solución Recomendada: Ciclo de Vida del Producto

```
CREACIÓN
   │
   ▼
┌─────────┐    (Usuario presiona accidentalmente)
│ENABLED  │ ──► Soft Delete ──► status="ACCIDENTAL" ──┐
└─────────┘                                             │
   │                                                    │
   ▼                                                    │
┌──────────────┐  (Se detecta duplicado con otro)      │
│IN USE        │ ──► Merge ──► status="DUPLICATE" ──┐ │
└──────────────┘                                      │ │
   │                                                  │ │
   ▼                                                  │ │
┌─────────────┐  (Ya no se vende)                    │ │
│OBSOLETE     │ ──► Soft Delete ──► status="OBSOLETE"─┼─┤
└─────────────┘                                      │ │
   │                                                  │ │
   └──────────────────────────────────────────────────┘ │
                                                        │
      NUNCA HACER HARD DELETE
      Solo soft delete con trazabilidad
```

### 📊 Estados Permitidos de un Producto

```typescript
// Ciclo de vida válido:

ESTADO_HABILITADO = "ENABLED"
  └─ isEnabled: true
  └─ disabledReason: null
  └─ Puede: venderse, editarse, mostrarse en reportes

ESTADO_DESHABILITADO_ACCIDENTAL = "DISABLED_ACCIDENTAL"
  └─ isEnabled: false
  └─ disabledReason: "Accidental"
  └─ disabledBy, disabledAt registrados
  └─ Puede: rehabilitarse fácilmente
  └─ Acción: Re-editar para habilitar

ESTADO_DESHABILITADO_DUPLICADO = "DISABLED_DUPLICATE"
  └─ isEnabled: false
  └─ disabledReason: "Duplicate"
  └─ mergedIntoProductId: 10 (primario)
  └─ NO puede: venderse nuevamente
  └─ Acción: Ver duplicados confirmados

ESTADO_OBSOLETO = "DISABLED_OBSOLETE"
  └─ isEnabled: false
  └─ disabledReason: "Obsolete"
  └─ Última venta: 2024-01-15
  └─ NO debe: reactivarse normalmente
  └─ Acción: Revisar antes de reactivar

ESTADO_MERGED = "DISABLED_MERGED"
  └─ isEnabled: false
  └─ disabledReason: "MERGED_WITH_PRIMARY"
  └─ mergedIntoProductId: 10
  └─ Completamente integrado en P10
  └─ NO puede: rehabilitarse (rompe integridad de datos)
```

### ✅ Protecciones contra Hard Delete

#### Regla 1: Bloquear eliminar producto si...
```
❌ Tiene documentos asociados (kardex no vacío)
❌ Tiene stock en almacén
❌ Ha sido parte de una fusión (como primary)
❌ Ha sido duplicado de otro producto
```

#### Regla 2: Antes de cualquier "borrado", validar
```
- ¿El usuario REALMENTE quiere borrar?
- ¿Ha confirmado que es accidental?
- ¿Ha revisado el historial de transacciones?
- ¿Hay alternativa más segura (deshabilitación)?
```

#### Regla 3: Si realmente necesita hard delete...
```
Opción: "PURGA SEGURA" (después de 90 días inactivo)
  1. Soft delete primero (isEnabled = false)
  2. Esperar 90 días sin cambios
  3. Usuario confirma: "Purgar después de 90 días"
  4. Sistema ejecuta: Hard delete + log de purga
  5. AuditLog: "PURGED - Producto eliminado permanentemente"
```

---

## 📅 Implementación por Fases

### Fase 1️⃣: Base de Datos (YA COMPLETADA ✅)

**Estado:** 100% Seguro, listo para push

```bash
✅ resource.ts actualizado con:
   - Nuevos campos en Product
   - Nuevas tablas: DisabledEntityHistory, ProductDuplicateCandidate, ProductMergeHistory
   - Campos extendidos en AuditLog

Próximo paso: amplify push
```

---

### Fase 2️⃣: Servicios (Backend)

**Timeline:** Semana 1

**Archivos a crear:**

1. `src/services/product-service.ts` (nuevo)
   - `detectDuplicatesByCode()`
   - `detectDuplicatesByName()`
   - `detectDuplicatesByBarcode()`
   - `levenshteinDistance()` (auxiliar)

2. `src/actions/disable-product.ts` (nuevo)
   - Deshabilitar con trazabilidad
   - Registrar en DisabledEntityHistory

3. `src/actions/enable-product.ts` (nuevo)
   - Reabilitar con validaciones
   - Alertas si merged

4. `src/actions/merge-products.ts` (nuevo)
   - Fusionar completo con transacción
   - Validar integridad

5. `src/actions/get-product-history.ts` (nuevo)
   - Traer historial completo

**Pruebas unitarias:**
```
✅ disableProduct() - disable, no debe afectar otros
✅ enableProduct() - re-enable, debe validar merged
✅ detectDuplicate() - detección exacta y fuzzy
✅ mergeProducts() - transacción completa, sin pérdida
```

---

### Fase 3️⃣: Interfaz de Usuario

**Timeline:** Semana 2

**Componentes a crear:**

1. `ProductFiltersPanel.tsx` (filtros complejos)
   - Estado, motivo, fecha, stock, grupo
   - búsqueda multi-campo

2. `ProductTableEnhanced.tsx` (tabla mejorada)
   - Columnas: Estado, Motivo, Deshabilitado, Merged
   - Acciones contextuales

3. `ProductHistoryModal.tsx` (historial)
   - Timeline de cambios
   - Audit log inline

4. `DuplicateDetectionPanel.tsx` (gestión de duplicados)
   - Pendientes, confirmados, rechazados
   - Botón "Fusionar"

5. `MergeProductsModal.tsx` (wizard fusión)
   - Validación
   - Resumen de cambios
   - Confirmación

6. `DisableProductModal.tsx` (deshabilitación)
   - Motivo (select)
   - Notas
   - Confirmación

---

### Fase 4️⃣: Reportes y Auditoría

**Timeline:** Semana 3

**Reportes nuevos:**

1. "Productos Deshabilitados" (Maestro Productos)
   - Cuándo, por qué, por quién
   - Reabilitar desde reporte

2. "Análisis de Duplicados" (Dashboard)
   - Cantidad de candidatos
   - Duplicados fusionados
   - Confianza promedio

3. "Historial de Fusiones" (Auditoría)
   - Qué se fusionó con qué
   - Documentos impactados
   - Cambios en stock

4. "Audit Trail Completo" (Compliance)
   - Todos los cambios a productos
   - Quién hizo qué y cuándo
   - Relaciones entre cambios

---

### Fase 5️⃣: Despliegue Producción

**Timeline:** Semana 4

```bash
1. amplify push
   └─ Verificar: Product: Update (NO Replace)

2. Deploy frontend
   └─ Incluir todos los componentes Fase 3

3. Migración de datos
   └─ Script: Analizar productos existentes
      └─ Identificar candidatos a duplicado
      └─ Preparar dados para revisión manual

4. Comunicación
   └─ Capacitación a usuarios
   └─ Guía de uso de filtros
   └─ Advertencia: No hard delete

5. Monitoreo
   └─ Alertas si muchos "accidentales" deshabilitados
   └─ Alertas si muchos duplicados detectados
```

---

## 🔒 Reglas de Integridad (CRÍTICAS)

### Regla 1: Nunca modificar `Product` base
```typescript
// ❌ PROHIBIDO
Product.idProduct = X  // NUNCA cambiar PK
Product.code = "nuevo"  // Si ya tiene transacciones

// ✅ PERMITIDO
Product.disabledReason = "Accidental"
Product.disabledAt = now()
Product.isEnabled = false
```

### Regla 2: Cascadas atomizadas
```typescript
// Cuando mergeas, TODA la transacción debe completarse o rollback
if (validateMerge() == false) {
  throw new Error("Merge not safe")
  // NO cambiar NADA
}

// Solo si validaciones OK:
await updateBarcodes()
await updateKardex()
await updateDocuments()
await updateProduct()
// Si alguno falla, TODO falla (transacción)
```

### Regla 3: Siempre registrar
```typescript
// Cada cambio = entrada en:
// 1. DisabledEntityHistory (si deshabilitación)
// 2. ProductMergeHistory (si merge)
// 3. AuditLog (siempre)
```

### Regla 4: Nunca hard delete productos con historial
```typescript
// ❌ PROHIBIDO
await deleteProduct(productId)

// ✅ PERMITIDO
await softDeleteProduct(productId, reason)
// Y SOLO después de 90 días + confirmación
```

---

## 🚨 Alertas y Notificaciones

### En Tiempo Real

```
1. Deshabilitación Accidental
   ┌─ ALERTA: Se deshabilitó producto durante creación
   │  └─ [Reabilitar] [Ignorar]

2. Candidato Duplicado Detectado
   ┌─ NOTIFICACIÓN: Nuevo duplicado detectado (95%)
   │  └─ [Revisar] [Ignorar]

3. Fusión Completada
   ┌─ CONFIRMACIÓN: Productos P001 y P002 fusionados
   │  └─ 23 documentos redirigidos
   │  └─ 47 entradas kardex consolidadas

4. Intento Rehabilitación Merged
   ┌─ ADVERTENCIA: Este producto fue fusionado con P001
   │  └─ ¿Deshacer merge? (PELIGROSO - perder datos)
   │  └─ [Proceder] [Cancelar]
```

---

## 📋 Checklist Implementación

### Antes de Push (Semana 0)
- [ ] Revisar `resource.ts` - Verificar que es 100% aditivo
- [ ] Backup de BD actual (aunque sea seguro)
- [ ] Documentar en `PLAN_COMPLETO_GESTION_PRODUCTOS.md` ✅

### Fase 2️⃣ - Servicios
- [ ] Crear `product-service.ts`
- [ ] Crear `disable-product.ts`
- [ ] Crear `enable-product.ts`
- [ ] Crear `merge-products.ts`
- [ ] Crear `get-product-history.ts`
- [ ] Tests unitarios pasen

### Fase 3️⃣ - UI
- [ ] `ProductFiltersPanel.tsx` completado
- [ ] `ProductTableEnhanced.tsx` completado
- [ ] `ProductHistoryModal.tsx` completado
- [ ] `DuplicateDetectionPanel.tsx` completado
- [ ] `MergeProductsModal.tsx` completado
- [ ] Estilos Tailwind/Radix UI aplicados

### Fase 4️⃣ - Reportes
- [ ] "Productos Deshabilitados" reporte
- [ ] "Análisis de Duplicados" reporte
- [ ] "Historial de Fusiones" reporte
- [ ] "Audit Trail" reporte

### Fase 5️⃣ - Producción
- [ ] `amplify push` exitoso
- [ ] BD validada (4200+ productos intactos)
- [ ] Migración de candidatos duplicados
- [ ] Capacitación usuarios
- [ ] Monitoreo 24/7 - Primera semana

---

## 📞 Preguntas Frecuentes

### P: ¿Perderé mis 4,000 productos?
**R:** NO. El push es 100% seguro y aditivo. Solo se agregan campos y tablas nuevas.

### P: ¿Puedo hacer hard delete?
**R:** No recomendado. Usa soft delete en su lugar. Hard delete rompe auditoría fiscal.

### P: ¿Qué pasa si mergeo dos productos?
**R:** Se consolidan en el producto primario. El duplicado queda marcado como `mergedIntoProductId`.

### P: ¿Se puede deshacer un merge?
**R:** Actualmente NO (es seguro así). Si necesitas revertir, se requiere intervención manual + script.

### P: ¿Cómo sé qué productos fueron deshabilitados hoy?
**R:** Usa filtro "Deshabilitados - Rango Fecha" en Maestro Productos.

### P: ¿Qué significa "Confidence 0.95"?
**R:** 95% de probabilidad de que sean duplicados según el algoritmo.

---

## 🎓 Conclusión

Este plan proporciona:

✅ **Trazabilidad completa** - Saber siempre qué pasó, cuándo y por qué  
✅ **Duplicado automático** - Detectar y fusionar sin perder datos  
✅ **Soft delete seguro** - No perder información fiscal  
✅ **UI intuitiva** - Filtros complejos pero fáciles de usar  
✅ **100% seguro de BD** - Cambios solo aditivos  

**Próximo paso:** Confirmar que el `amplify push` es seguro, luego iniciar Fase 2️⃣.

---

_Documento: PLAN_COMPLETO_GESTION_PRODUCTOS.md_  
_Versión: 1.0_  
_Fecha: Junio 10, 2026_
