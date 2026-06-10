# 🚀 Guía de Integración - Sistema de Gestión de Productos Mejorado

**Fecha:** Junio 10, 2026  
**Estado:** 100% Implementado  
**Archivos Creados:** 14 archivos

---

## 📂 Estructura de Archivos Creados

### Servicios Backend (4 archivos)

```
src/actions/
├── disable-product-action.ts      ← Deshabilitación con trazabilidad
├── enable-product-action.ts       ← Rehabilitación con validaciones
├── merge-products-action.ts       ← Fusión de productos (transacción)
└── get-product-history-action.ts  ← Historial completo del producto

src/services/
└── product-service.ts             ← Detección de duplicados
```

### Componentes React (7 archivos)

```
src/components/products/
├── ProductFiltersPanel.tsx        ← Filtros avanzados
├── ProductTableEnhanced.tsx       ← Tabla de productos mejorada
├── DisableProductModal.tsx        ← Modal de deshabilitación
├── EnableProductModal.tsx         ← Modal de rehabilitación
├── MergeProductsModal.tsx         ← Modal de fusión (3 pasos)
├── ProductHistoryModal.tsx        ← Modal de historial
├── DuplicateDetectionPanel.tsx    ← Panel de gestión de duplicados
└── MaestroProductosPage.tsx       ← Página completa integrada
```

### Hooks (1 archivo)

```
src/hooks/
└── useProducts.ts                 ← Hooks para gestionar productos
```

---

## 🔌 Cómo Integrar en tu Aplicación

### Paso 1: Copiar Archivos

Todos los archivos ya están creados en sus ubicaciones correctas:
- ✅ Servicios en `src/services/`
- ✅ Actions en `src/actions/`
- ✅ Componentes en `src/components/products/`
- ✅ Hooks en `src/hooks/`

### Paso 2: Actualizar tu Página de Maestro Productos

Si ya tienes una página de maestro productos, reemplaza su contenido:

```tsx
// src/app/products/page.tsx (o similar)

import { MaestroProductosPage } from '@/components/products/MaestroProductosPage';

export default function ProductsPage() {
  return <MaestroProductosPage />;
}
```

### Paso 3: Traer Datos de BD

En la página, reemplaza `DEMO_PRODUCTS` con datos reales:

```tsx
// En src/components/products/MaestroProductosPage.tsx

import { generateClient } from 'aws-amplify/api';
import type { Schema } from '@/../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'apiKey' });

export async function getMaestroProductosPage() {
  const products = await client.models.Product.list();
  return <MaestroProductosPage products={products.data} />;
}
```

### Paso 4: Verificar Amplify (Crítico)

Antes de hacer `amplify push`, verifica `resource.ts`:

```bash
# 1. Abrir amplify/data/resource.ts
# 2. Buscar estas tablas (deben existir):
#    ✅ Product (con campos nuevos)
#    ✅ DisabledEntityHistory
#    ✅ ProductDuplicateCandidate
#    ✅ ProductMergeHistory
#    ✅ AuditLog (extendido)

# 3. Ejecutar push (SEGURO, cambios solo aditivos)
npx ampx sandbox   # Primero sandbox
# o
amplify push       # Producción
```

### Paso 5: Verificar el Push

Cuando veas el diff en consola:

```
✅ Product: Update (NO "Replace")
✅ DisabledEntityHistory: Create
✅ ProductDuplicateCandidate: Create
✅ ProductMergeHistory: Create
✅ AuditLog: Update
```

Si ves "Replace" o "Delete", **NO CONFIRMES**. Contacta soporte.

---

## 🎯 Características Implementadas

### ✅ Deshabilitación de Productos

```tsx
// Usar en componentes:
import { disableProduct } from '@/actions/disable-product-action';

const result = await disableProduct(
  productId,
  'Accidental', // o 'Duplicate', 'Obsolete', 'Temporary'
  'Notas opcionales',
  userId
);

if (result.success) {
  console.log(result.message);
}
```

### ✅ Rehabilitación de Productos

```tsx
import { enableProduct } from '@/actions/enable-product-action';

const result = await enableProduct(
  productId,
  'Razón de rehabilitación',
  userId
);

// Retorna advertencias si fue merged
if (result.warnings) {
  console.warn(result.warnings);
}
```

### ✅ Detección de Duplicados

```tsx
import { 
  runFullDuplicateDetection,
  detectDuplicatesByCode,
  detectDuplicatesByName,
  detectDuplicatesByFuzzyName,
  detectDuplicatesByBarcode,
} from '@/services/product-service';

// Detección completa
const results = await runFullDuplicateDetection();

console.log(results);
// {
//   exactCode: [...],
//   exactName: [...],
//   fuzzyName: [...],
//   barcode: [...],
// }
```

### ✅ Fusión de Productos

```tsx
import { validateMerge, mergeProducts } from '@/actions/merge-products-action';

// Primero validar
const validation = await validateMerge(primaryId, duplicateId);

if (validation.canMerge) {
  // Luego fusionar
  const result = await mergeProducts(primaryId, duplicateId, userId);
  
  if (result.success) {
    console.log(result.summary);
    // {
    //   barcodesMerged: 3,
    //   kardexMerged: 47,
    //   documentsMerged: 23,
    //   stocksMerged: 2,
    // }
  }
}
```

### ✅ Historial de Producto

```tsx
import { getProductHistory } from '@/actions/get-product-history-action';

const history = await getProductHistory(productId);

if (history.success) {
  const { product, timeline, disabledHistory, mergeHistory } = history.data;
  
  // Timeline contiene todos los cambios ordenados cronológicamente
  timeline.forEach(event => {
    console.log(`${event.type}: ${event.description}`);
  });
}
```

---

## 🎨 Componentes Disponibles

### ProductFiltersPanel
**Propósito:** Interfaz de filtros avanzados

```tsx
import { ProductFiltersPanel } from '@/components/products/ProductFiltersPanel';

<ProductFiltersPanel
  onApply={(filters) => console.log(filters)}
  onClear={() => console.log('cleared')}
  productGroups={[
    { id: 1, name: 'Herramientas' },
    { id: 2, name: 'Clavos' },
  ]}
/>
```

**Filtros disponibles:**
- Estado (Habilitado/Deshabilitado/Todos)
- Motivo (Accidental, Duplicado, Obsoleto, Temporal)
- Rango de fecha de deshabilitación
- Stock (Con/Sin/Negativo)
- Grupo de producto
- Búsqueda por nombre/código/PLU

### ProductTableEnhanced
**Propósito:** Tabla de productos con acciones

```tsx
import { ProductTableEnhanced } from '@/components/products/ProductTableEnhanced';

<ProductTableEnhanced
  products={products}
  loading={loading}
  onProductsChange={() => refetch()}
/>
```

**Acciones incluidas:**
- 📜 Ver historial
- ❌ Deshabilitar
- ✅ Habilitar
- 🔗 Indicador de merged

### DuplicateDetectionPanel
**Propósito:** Gestión de duplicados detectados

```tsx
import { DuplicateDetectionPanel } from '@/components/products/DuplicateDetectionPanel';

<DuplicateDetectionPanel />
```

**Funcionalidades:**
- Ejecutar detección completa
- Revisar candidatos pendientes
- Confirmar/rechazar candidatos
- Fusionar directamente desde panel

### Modales

Todos los modales están integrados en `ProductTableEnhanced`, pero pueden usarse independientemente:

```tsx
import { DisableProductModal } from '@/components/products/DisableProductModal';
import { EnableProductModal } from '@/components/products/EnableProductModal';
import { MergeProductsModal } from '@/components/products/MergeProductsModal';
import { ProductHistoryModal } from '@/components/products/ProductHistoryModal';

// Ver ejemplos en ProductTableEnhanced.tsx
```

---

## 🧪 Testing

### Detectar Duplicados (Manual)

```bash
# En consola del navegador:

import { runFullDuplicateDetection } from '@/services/product-service';

const results = await runFullDuplicateDetection();
console.log(results);
```

### Deshabilitar Producto (Manual)

```bash
import { disableProduct } from '@/actions/disable-product-action';

const result = await disableProduct(1, 'Accidental', 'Test', 1);
console.log(result);
```

### Fusionar Productos (Manual)

```bash
import { mergeProducts } from '@/actions/merge-products-action';

const result = await mergeProducts(1, 2, 1);
console.log(result);
```

---

## 📊 Datos en BD

### Después del Push

Tendrás estas tablas nuevas/actualizadas:

**Product** (actualizado)
```
idProduct: number
name: string
code: string
isEnabled: boolean          ← NEW
disabledReason?: string     ← NEW
disabledAt?: datetime       ← NEW
lastEnabledAt?: datetime    ← NEW
mergedIntoProductId?: number ← NEW
duplicateGroupId?: number   ← NEW
... (otros campos igual)
```

**DisabledEntityHistory** (nueva)
```
historyId: string
entityType: string        // "Product", "Document", "User"
entityId: number
reason: string
disabledBy: number        // userId
disabledAt: datetime
reenabledBy?: number
reenabledAt?: datetime
reenableReason?: string
tags: string[]
notes: string
```

**ProductDuplicateCandidate** (nueva)
```
candidateId: string
primaryProductId: number
duplicateProductId: number
matchType: string         // "EXACT_CODE", "EXACT_NAME", "FUZZY_NAME", "BARCODE"
confidence: float         // 0.0 - 1.0
status: string            // "PENDING", "CONFIRMED", "REJECTED", "MERGED"
detectedAt: datetime
detectedBy: string
reason: string
notes: string
```

**ProductMergeHistory** (nueva)
```
mergeId: string
primaryProductId: number
duplicateProductId: number
mergedBy: number          // userId
mergedAt: datetime
barcodesMerged: integer
commentsMerged: integer
stockControlsMerged: integer
notes: string
reversible: boolean
```

**AuditLog** (extendido)
```
logId: string
userId: number
action: string
tableName: string
recordId: number
oldValues: string
newValues: string
timestamp: datetime
reason?: string           ← NEW
relatedRecords?: string   ← NEW
impactedDocuments?: integer ← NEW
```

---

## 🚨 Troubleshooting

### Problema: "Cannot find module @/actions/..."

**Solución:** Verifica que los archivos estén en:
- `src/actions/disable-product-action.ts` ✅
- `src/actions/enable-product-action.ts` ✅
- `src/actions/merge-products-action.ts` ✅
- `src/actions/get-product-history-action.ts` ✅

### Problema: "Product model not found"

**Solución:** Ejecuta `amplify push` primero

### Problema: Modal no aparece

**Solución:** Verifica que `Button` componente existe en `@/components/ui/button`

Si no existe, crea:
```bash
npx shadcn-ui@latest add button
```

### Problema: Merge falla silenciosamente

**Solución:** Revisa que tienes permisos en BD. Verifica que el usuario tiene `userId`.

---

## 📈 Próximos Pasos

1. ✅ **Hecho:** Amplify push (BD)
2. ✅ **Hecho:** Servicios backend
3. ✅ **Hecho:** Componentes React
4. [ ] Capacitación a usuarios
5. [ ] Monitoreo en producción (primera semana)

---

## 📞 Contacto

Para preguntas o issues, revisa:
- `PLAN_COMPLETO_GESTION_PRODUCTOS.md`
- `ESTRATEGIA_ELIMINACION_DUPLICADOS_PROFUNDO.md`
- `GUIA_IMPLEMENTACION_TECNICA.md`

---

_Documento: README_INTEGRACION.md_  
_Versión: 1.0_
