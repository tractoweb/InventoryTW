# ⚠️ VERSIÓN SEGURA - NO ALTERAR resource.ts

## 🛑 PROBLEMA DESCUBIERTO

Si alteras `amplify/data/resource.ts` y ejecutas `npx ampx sandbox`:
- DynamoDB se **LIMPIA COMPLETAMENTE**
- **TODOS los datos se pierden**
- No hay forma de recuperarlos

## ✅ SOLUCIÓN: Usar SOLO campos existentes

El modelo `Product` ya tiene TODOS los campos necesarios:

```typescript
Product: a.model({
  // ... campos existentes ...
  
  // ✅ ESTOS CAMPOS YA EXISTEN:
  isEnabled: a.boolean().default(true),
  disabledReason: a.string(),                    // Razón de deshabilitación
  disabledAt: a.datetime(),                      // Cuándo se deshabilitó
  lastEnabledAt: a.datetime(),                   // Última vez activo
  mergedIntoProductId: a.integer(),              // Si fue merged
  duplicateGroupId: a.integer(),                 // Grupo de duplicados
})
```

---

## 📋 SERVER ACTIONS SEGUROS

### ✅ `delete-product-safe.ts`
```typescript
import { deleteProduct } from "@/actions/delete-product-safe";

// Usar SOLO campos existentes
await deleteProduct(productId, "Accidental", "details");
// Actualiza: isEnabled, disabledReason, disabledAt
```

### ✅ `detect-duplicate-products-safe.ts`
```typescript
import { detectDuplicateProductsSafe } from "@/actions/detect-duplicate-products-safe";

// Retorna candidatos EN MEMORIA (no en BD)
const { duplicateGroups } = await detectDuplicateProductsSafe();
// groups[].primaryProductId, duplicateProductIds
// Guarda auditoría en AuditLog
```

### ✅ `merge-products-safe.ts`
```typescript
import { mergeProductsSafe } from "@/actions/merge-products-safe";

// Transacción atómica usando SOLO campos existentes
const result = await mergeProductsSafe(100, 101, "notes");
// Actualiza:
//   - Transfiere barcodes
//   - Transfiere comentarios
//   - Marca duplicado: isEnabled=false, mergedIntoProductId=100
```

---

## 🔍 QUID PRO QUO

**LO QUE GANAMOS:**
- ✅ BD en producción segura
- ✅ Datos preservados
- ✅ Sin riesgo de reinicio

**LO QUE PERDEMOS:**
- ❌ Tabla histórica DisabledEntityHistory
- ❌ Tabla ProductDuplicateCandidate en BD
- ❌ Tabla ProductMergeHistory en BD

**PERO IGUAL TENEMOS:**
- ✅ Auditoría en AuditLog (existe)
- ✅ Candidatos EN MEMORIA (se recalculan)
- ✅ Histórico en campos (isEnabled, disabledAt, mergedIntoProductId)

---

## 📊 ARQUITECTURA FINAL

```
┌─ PRODUCTO DESHABILITADO
│  ├─ isEnabled = false
│  ├─ disabledReason = "Accidental" | "Duplicate" | "Obsolete" | etc.
│  ├─ disabledAt = 2026-06-10T10:30:00Z
│  └─ lastEnabledAt = 2026-05-20T15:00:00Z
│
├─ PRODUCTO MERGED
│  ├─ isEnabled = false
│  ├─ disabledReason = "MERGED_WITH_PRIMARY"
│  └─ mergedIntoProductId = 100 (el primario)
│
├─ AUDITORÍA (en AuditLog)
│  ├─ action = "PRODUCT_DISABLE" | "PRODUCT_MERGE"
│  ├─ userId = quién lo hizo
│  ├─ details = { productCode, reason, notes }
│  └─ timestamp = cuándo
│
└─ DUPLICADOS EN MEMORIA
   ├─ Se recalculan cada vez que se abre la UI
   ├─ Se muestran en modal de candidatos
   └─ Usuario confirma antes de merge
```

---

## 🚀 INTEGRACIÓN

### En `products-master-client.tsx`:

```tsx
"use client";

import { AdvancedProductFilters } from "@/app/inventory/components/advanced-product-filters";
import { DisabledProductDetailsModal } from "@/app/inventory/components/disabled-product-details-modal";
import { MergeProductsModal } from "@/app/inventory/components/merge-products-modal";
import { detectDuplicateProductsSafe } from "@/actions/detect-duplicate-products-safe";

export default function ProductsMaster() {
  const [filters, setFilters] = useState({});
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [selectedModal, setSelectedModal] = useState<'details' | 'merge' | null>(null);

  const handleDetectDuplicates = async () => {
    const { duplicateGroups } = await detectDuplicateProductsSafe();
    setDuplicateGroups(duplicateGroups);
    // Mostrar alerta con resultados
  };

  return (
    <div>
      {/* Filtros + botón detectar */}
      <AdvancedProductFilters onFiltersChange={setFilters} />
      <Button onClick={handleDetectDuplicates}>🔍 Detectar Duplicados</Button>

      {/* Tabla con nuevas columnas */}
      <ProductsTable
        products={filteredProducts}
        onDetails={(p) => setSelectedModal('details')}
        onMerge={(candidate) => setSelectedModal('merge')}
      />

      {/* Modales */}
      <DisabledProductDetailsModal open={selectedModal === 'details'} />
      <MergeProductsModal open={selectedModal === 'merge'} />
    </div>
  );
}
```

---

## ✅ CHECKLIST ANTES DE DEPLOY

- [ ] resource.ts NO ha sido alterado (git diff vacío)
- [ ] `npx ampx sandbox` está corriendo con datos
- [ ] Server actions usan `-safe.ts` versions
- [ ] Modales están integrados en tabla
- [ ] Botón "Detectar duplicados" funciona
- [ ] Merge preserve Kardex + DocumentItems
- [ ] Auditoría se guarda en AuditLog
- [ ] Testing manual en BD real ✅

---

## ⚠️ IMPORTANTE

**NUNCA:**
```bash
git add amplify/data/resource.ts
npx ampx sandbox  # ❌ ESTO BORRA LA BD
```

**SIEMPRE:**
```bash
# Solo usar -safe.ts versions
import { deleteProduct } from "@/actions/delete-product-safe";
import { detectDuplicateProductsSafe } from "@/actions/detect-duplicate-products-safe";
import { mergeProductsSafe } from "@/actions/merge-products-safe";
```

---

**Documentación:** Última actualización 2026-06-10
