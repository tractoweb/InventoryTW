# Guía de Uso - Sistema de Trazabilidad y Deduplicación

## 🚀 Inicio Rápido

### 1️⃣ Ejecutar Detección de Duplicados

```typescript
// En cualquier servidor action o página
import { detectDuplicateProducts } from "@/actions/detect-duplicate-products";

const result = await detectDuplicateProducts();
// Retorna: { success, candidatesCreated, message }
```

### 2️⃣ Ver Candidatos Detectados

```typescript
import { getDuplicateCandidates } from "@/actions/get-duplicate-candidates";

const { data: candidates } = await getDuplicateCandidates("PENDING");
// data: Array<DuplicateCandidate>
```

### 3️⃣ Fusionar Dos Productos

```typescript
import { mergeProducts } from "@/actions/merge-products";

const result = await mergeProducts(100, 101, "Import error");
// Retorna: { success, mergeId, barcodesMerged, commentsMerged }
```

### 4️⃣ Deshabilitar Producto (con razón)

```typescript
import { deleteProduct } from "@/actions/delete-product";

const result = await deleteProduct(100, "Accidental");
// Registra automáticamente en DisabledEntityHistory
```

### 5️⃣ Rehabilitar Producto

```typescript
import { reEnableProduct } from "@/actions/re-enable-product";

const result = await reEnableProduct(100, "Was accidental");
// Actualiza DisabledEntityHistory.reenabledAt
```

---

## 📊 COMPONENTES UI

### AdvancedProductFilters

```tsx
import { AdvancedProductFilters } from "@/app/inventory/components/advanced-product-filters";

<AdvancedProductFilters
  onFiltersChange={(filters) => console.log(filters)}
  onApply={() => {}}
  productGroups={groups}
  warehouses={warehouses}
  users={users}
/>
```

**Secciones:**
- 📊 Básicos (búsqueda, grupo, estado)
- 🏷️ Códigos & Duplicados (código único, duplicados, barcode)
- 📦 Inventario (stock, almacén, cantidad)
- 💰 Financiero (precio, costo, markup)
- 📝 Documentos & Kardex (referencias, período)
- 🗑️ Deshabilitación (razón, período, usuario, accidental?)

### DisabledProductDetailsModal

```tsx
import { DisabledProductDetailsModal } from "@/app/inventory/components/disabled-product-details-modal";

<DisabledProductDetailsModal
  product={selectedProduct}
  open={modalOpen}
  onOpenChange={setModalOpen}
  onReenabled={() => {}}
/>
```

**Muestra:**
- Razón de deshabilitación
- Timestamps (deshabilitado, última activación)
- Impacto (documentos, stock, kardex)
- Botón rehabilitar (si no está merged)

### MergeProductsModal

```tsx
import { MergeProductsModal } from "@/app/inventory/components/merge-products-modal";

<MergeProductsModal
  candidate={duplicateCandidate}
  open={modalOpen}
  onOpenChange={setModalOpen}
  onMerged={() => {}}
/>
```

**Muestra:**
- Comparativa primario vs duplicado
- Confianza (%)
- Qué se transfiere (barcodes, comments, stockControls)
- Qué se preserva (documentos, kardex)
- Confirmación requerida

---

## 🔍 QUERIES ÚTILES

### Obtener productos deshabilitados

```typescript
import { getDisabledProducts } from "@/actions/get-disabled-products";

// Sin filtros
const { data: all } = await getDisabledProducts();

// Con filtros
const { data: accidentals } = await getDisabledProducts({
  reason: "Accidental",
  period: "7days"
});
```

### Obtener estadísticas

```typescript
import { getDisabledProductsStats } from "@/actions/get-disabled-products";

const stats = await getDisabledProductsStats();
// { totalDisabled, byReason, accidentalCount, duplicateCount }
```

### Validar código único

```typescript
import { validateProductCode } from "@/actions/validate-product-code";

const validation = await validateProductCode("MB-001", 100); // excludeProductId
// { valid, error, conflictProductId, conflictProductName }
```

### Obtener todos con código duplicado

```typescript
import { getProductsByCode } from "@/actions/validate-product-code";

const { data: products } = await getProductsByCode("MB-001");
// Incluye activos y deshabilitados
```

---

## 🔐 PERMISOS

Todas las operaciones requieren `ACCESS_LEVELS.ADMIN`:
- Deshabilitar producto
- Merge de productos
- Rehabilitar producto
- Detección de duplicados

---

## 📝 EJEMPLO: Integración Completa

```tsx
"use client";

import { useState } from "react";
import { AdvancedProductFilters } from "@/app/inventory/components/advanced-product-filters";
import { DisabledProductDetailsModal } from "@/app/inventory/components/disabled-product-details-modal";
import { MergeProductsModal } from "@/app/inventory/components/merge-products-modal";
import { detectDuplicateProducts } from "@/actions/detect-duplicate-products";
import { getDuplicateCandidates } from "@/actions/get-duplicate-candidates";
import { Button } from "@/components/ui/button";

export default function ProductsMaster() {
  const [filters, setFilters] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  const handleDetectDuplicates = async () => {
    await detectDuplicateProducts();
    // Refresh tabla
  };

  const handleOpenDuplicates = async () => {
    const { data: candidates } = await getDuplicateCandidates("PENDING");
    // Mostrar en tabla
  };

  return (
    <div className="space-y-4">
      {/* Filtros avanzados */}
      <AdvancedProductFilters
        onFiltersChange={setFilters}
        onApply={() => {}}
        productGroups={[]}
        warehouses={[]}
        users={[]}
      />

      {/* Botones de acción */}
      <div className="flex gap-2">
        <Button onClick={handleDetectDuplicates}>
          🔍 Detectar Duplicados
        </Button>
        <Button onClick={handleOpenDuplicates}>
          📋 Ver Candidatos
        </Button>
      </div>

      {/* Tabla de productos */}
      {/* ... tabla aquí con acciones: ver detalles, merge, deshabilitar */}

      {/* Modales */}
      <DisabledProductDetailsModal
        product={selectedProduct}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
      />

      <MergeProductsModal
        candidate={selectedCandidate}
        open={mergeModalOpen}
        onOpenChange={setMergeModalOpen}
      />
    </div>
  );
}
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Hard Delete no existe** - Solo soft-delete (isEnabled = false)
2. **Preservación de auditoría** - Documentos/Kardex NUNCA se tocan en merge
3. **Transacciones atómicas** - Merge es transaccional (todo o nada)
4. **IP + UserAgent** - Se registra en cada auditoría
5. **Solo ADMIN** - Todas las operaciones críticas requieren acceso admin
6. **DisabledEntityHistory** - Es el registro central de deshabilitaciones/rehabilitaciones

---

## 🐛 TROUBLESHOOTING

**Q: "El código ya existe"**
A: Validar() comprueba solo entre ACTIVOS. Si otro está deshabilitado, ese código está libre.

**Q: "No puedo rehabilitar"**
A: Si fue merged, está vinculado a otro. Ver mergedIntoProductId en Product.

**Q: "¿Dónde veo el historial?"**
A: DisabledEntityHistory tiene reenabledBy, reenabledAt, reenableReason.

**Q: "¿Puedo deshacer un merge?"**
A: NO. ProductMergeHistory.reversible = false por razones de auditoría.

