# Guía de Implementación Técnica: Fase 2 y 3

**Referencia:** PLAN_COMPLETO_GESTION_PRODUCTOS.md (Fases 2️⃣ y 3️⃣)  
**Status:** Listo para iniciar desarrollo  
**Fecha:** Junio 10, 2026

---

## 📑 Índice

1. [Fase 2️⃣: Servicios Backend](#fase-2-servicios-backend)
2. [Fase 3️⃣: Componentes UI](#fase-3-componentes-ui)
3. [Ejemplos de Código](#ejemplos-de-código)
4. [Testing](#testing)
5. [Checklist de Deployment](#checklist-de-deployment)

---

## Fase 2️⃣: Servicios Backend

### Archivo 1: `src/services/product-service.ts`

**Propósito:** Lógica de detección de duplicados

```typescript
// src/services/product-service.ts

import { generateClient } from 'aws-amplify/api';
import type { Schema } from '@/../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'apiKey' });

/**
 * Calcula distancia Levenshtein entre dos strings
 * Útil para detectar "TORNILLO" vs "TORNILO"
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calcula similitud (0.0 - 1.0) basada en Levenshtein
 */
function calculateSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1.0 - distance / maxLen;
}

/**
 * DETECCIÓN: Busca duplicados por CÓDIGO exacto
 */
export async function detectDuplicatesByCode() {
  console.log('🔍 Detectando duplicados por código...');
  
  const allProducts = await client.models.Product.list({
    filter: { isEnabled: { eq: true } },
  });
  
  const byCode = new Map<string, Schema['Product'][]>();
  
  for (const product of allProducts.data) {
    if (!product.code) continue;
    
    const key = product.code.toUpperCase();
    if (!byCode.has(key)) {
      byCode.set(key, []);
    }
    byCode.get(key)!.push(product);
  }
  
  const duplicates: Schema['ProductDuplicateCandidate'][] = [];
  
  for (const [code, products] of byCode.entries()) {
    if (products.length > 1) {
      // Asumir primero como "primary"
      const primary = products[0];
      
      for (let i = 1; i < products.length; i++) {
        const duplicate = products[i];
        
        const candidate = {
          primaryProductId: primary.idProduct!,
          duplicateProductId: duplicate.idProduct!,
          matchType: 'EXACT_CODE' as const,
          confidence: 0.99,
          detectedAt: new Date(),
          detectedBy: 'SYSTEM',
          status: 'PENDING' as const,
          reason: `Código exacto: ${code}`,
        };
        
        duplicates.push(candidate);
        
        // Crear en BD
        await client.models.ProductDuplicateCandidate.create(candidate);
      }
    }
  }
  
  console.log(`✅ Encontrados ${duplicates.length} duplicados por código`);
  return duplicates;
}

/**
 * DETECCIÓN: Busca duplicados por NOMBRE exacto
 */
export async function detectDuplicatesByName() {
  console.log('🔍 Detectando duplicados por nombre...');
  
  const allProducts = await client.models.Product.list({
    filter: { isEnabled: { eq: true } },
  });
  
  const byName = new Map<string, Schema['Product'][]>();
  
  for (const product of allProducts.data) {
    if (!product.name) continue;
    
    const key = product.name.toUpperCase();
    if (!byName.has(key)) {
      byName.set(key, []);
    }
    byName.get(key)!.push(product);
  }
  
  const duplicates: Schema['ProductDuplicateCandidate'][] = [];
  
  for (const [name, products] of byName.entries()) {
    if (products.length > 1) {
      const primary = products[0];
      
      for (let i = 1; i < products.length; i++) {
        const duplicate = products[i];
        
        const candidate = {
          primaryProductId: primary.idProduct!,
          duplicateProductId: duplicate.idProduct!,
          matchType: 'EXACT_NAME' as const,
          confidence: 0.95,
          detectedAt: new Date(),
          detectedBy: 'SYSTEM',
          status: 'PENDING' as const,
          reason: `Nombre exacto: ${name}`,
        };
        
        duplicates.push(candidate);
        await client.models.ProductDuplicateCandidate.create(candidate);
      }
    }
  }
  
  console.log(`✅ Encontrados ${duplicates.length} duplicados por nombre`);
  return duplicates;
}

/**
 * DETECCIÓN: Busca duplicados por NOMBRE similar (fuzzy)
 */
export async function detectDuplicatesByFuzzyName(similarity = 0.8) {
  console.log(`🔍 Detectando duplicados por nombre similar (similarity > ${similarity})...`);
  
  const allProducts = await client.models.Product.list({
    filter: { isEnabled: { eq: true } },
  });
  
  const duplicates: Schema['ProductDuplicateCandidate'][] = [];
  
  for (let i = 0; i < allProducts.data.length; i++) {
    for (let j = i + 1; j < allProducts.data.length; j++) {
      const p1 = allProducts.data[i];
      const p2 = allProducts.data[j];
      
      if (!p1.name || !p2.name) continue;
      
      const sim = calculateSimilarity(p1.name, p2.name);
      
      if (sim >= similarity) {
        // Crear candidato con el producto más antiguo como primario
        const primary = p1.idProduct! < p2.idProduct! ? p1 : p2;
        const duplicate = primary === p1 ? p2 : p1;
        
        const candidate = {
          primaryProductId: primary.idProduct!,
          duplicateProductId: duplicate.idProduct!,
          matchType: 'FUZZY_NAME' as const,
          confidence: sim,
          detectedAt: new Date(),
          detectedBy: 'SYSTEM',
          status: 'PENDING' as const,
          reason: `Nombre similar: ${sim.toFixed(2)}%`,
        };
        
        duplicates.push(candidate);
        await client.models.ProductDuplicateCandidate.create(candidate);
      }
    }
  }
  
  console.log(`✅ Encontrados ${duplicates.length} duplicados por nombre fuzzy`);
  return duplicates;
}

/**
 * DETECCIÓN: Busca duplicados por BARCODE
 */
export async function detectDuplicatesByBarcode() {
  console.log('🔍 Detectando duplicados por código de barras...');
  
  const allBarcodes = await client.models.Barcode.list();
  
  const byBarcode = new Map<string, Schema['Barcode'][]>();
  
  for (const barcode of allBarcodes.data) {
    if (!byBarcode.has(barcode.value)) {
      byBarcode.set(barcode.value, []);
    }
    byBarcode.get(barcode.value)!.push(barcode);
  }
  
  const duplicates: Schema['ProductDuplicateCandidate'][] = [];
  
  for (const [barcodeValue, barcodes] of byBarcode.entries()) {
    if (barcodes.length > 1) {
      const primary = barcodes[0];
      
      for (let i = 1; i < barcodes.length; i++) {
        const duplicate = barcodes[i];
        
        const candidate = {
          primaryProductId: primary.productId!,
          duplicateProductId: duplicate.productId!,
          matchType: 'BARCODE' as const,
          confidence: 0.98,
          detectedAt: new Date(),
          detectedBy: 'SYSTEM',
          status: 'PENDING' as const,
          reason: `Código de barras: ${barcodeValue}`,
        };
        
        duplicates.push(candidate);
        await client.models.ProductDuplicateCandidate.create(candidate);
      }
    }
  }
  
  console.log(`✅ Encontrados ${duplicates.length} duplicados por barcode`);
  return duplicates;
}

/**
 * DETECCIÓN: Ejecuta TODAS las detecciones
 */
export async function runFullDuplicateDetection() {
  console.log('\n🚀 Iniciando detección COMPLETA de duplicados...\n');
  
  const results = {
    exactCode: await detectDuplicatesByCode(),
    exactName: await detectDuplicatesByName(),
    fuzzyName: await detectDuplicatesByFuzzyName(0.8),
    barcode: await detectDuplicatesByBarcode(),
  };
  
  const total = 
    results.exactCode.length + 
    results.exactName.length + 
    results.fuzzyName.length + 
    results.barcode.length;
  
  console.log('\n📊 RESUMEN DE DETECCIÓN:');
  console.log(`├─ Código exacto: ${results.exactCode.length}`);
  console.log(`├─ Nombre exacto: ${results.exactName.length}`);
  console.log(`├─ Nombre fuzzy: ${results.fuzzyName.length}`);
  console.log(`├─ Código de barras: ${results.barcode.length}`);
  console.log(`└─ TOTAL: ${total}\n`);
  
  return results;
}

/**
 * OBTENER: Candidatos pendientes
 */
export async function getPendingDuplicateCandidates() {
  const candidates = await client.models.ProductDuplicateCandidate.list({
    filter: { status: { eq: 'PENDING' } },
  });
  
  return candidates.data;
}

/**
 * OBTENER: Historial de fusiones
 */
export async function getMergeHistory(productId: number) {
  const merges = await client.models.ProductMergeHistory.list({
    filter: {
      or: [
        { primaryProductId: { eq: productId } },
        { duplicateProductId: { eq: productId } },
      ],
    },
  });
  
  return merges.data;
}
```

---

### Archivo 2: `src/actions/disable-product.ts`

**Propósito:** Deshabilitación segura con trazabilidad

```typescript
'use server';

// src/actions/disable-product.ts

import { generateClient } from 'aws-amplify/api';
import type { Schema } from '@/../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'apiKey' });

export async function disableProduct(
  productId: number,
  reason: 'Accidental' | 'Duplicate' | 'Obsolete' | 'Temporary',
  notes?: string,
  userId: number = 1 // Default user for demo
): Promise<{ success: boolean; message: string; historyId?: string }> {
  try {
    // 1. Validar que el producto existe
    const product = await client.models.Product.get(
      { idProduct: productId },
      { selectionSet: ['idProduct', 'name', 'isEnabled'] }
    );

    if (!product) {
      return { success: false, message: 'Producto no encontrado' };
    }

    if (!product.isEnabled) {
      return { success: false, message: 'El producto ya está deshabilitado' };
    }

    // 2. Crear entrada en DisabledEntityHistory
    const historyId = `DH-${Date.now()}-${productId}`;
    
    await client.models.DisabledEntityHistory.create({
      historyId,
      entityType: 'Product',
      entityId: productId,
      reason,
      disabledBy: userId,
      disabledAt: new Date(),
      tags: [reason],
      notes: notes || '',
    });

    // 3. Actualizar producto
    await client.models.Product.update({
      idProduct: productId,
      isEnabled: false,
      disabledReason: reason,
      disabledAt: new Date(),
    });

    // 4. Registrar en AuditLog
    await client.models.AuditLog.create({
      logId: `AL-${Date.now()}`,
      userId,
      action: 'DISABLED',
      tableName: 'Product',
      recordId: productId,
      timestamp: new Date(),
      reason: `Producto deshabilitado por: ${reason}`,
      relatedRecords: JSON.stringify({ productId, reason }),
    });

    return {
      success: true,
      message: `✅ Producto "${product.name}" deshabilitado correctamente`,
      historyId,
    };
  } catch (error) {
    console.error('Error deshabilitando producto:', error);
    return {
      success: false,
      message: 'Error al deshabilitar el producto',
    };
  }
}
```

---

### Archivo 3: `src/actions/enable-product.ts`

**Propósito:** Rehabilitación con validaciones

```typescript
'use server';

// src/actions/enable-product.ts

import { generateClient } from 'aws-amplify/api';
import type { Schema } from '@/../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'apiKey' });

export async function enableProduct(
  productId: number,
  reason?: string,
  userId: number = 1
): Promise<{
  success: boolean;
  message: string;
  warnings?: string[];
}> {
  try {
    // 1. Obtener producto
    const product = await client.models.Product.get(
      { idProduct: productId },
      {
        selectionSet: [
          'idProduct',
          'name',
          'isEnabled',
          'mergedIntoProductId',
          'disabledReason',
        ],
      }
    );

    if (!product) {
      return { success: false, message: 'Producto no encontrado' };
    }

    if (product.isEnabled) {
      return { success: false, message: 'El producto ya está habilitado' };
    }

    // 2. Validar: Si fue merged, advertencia
    const warnings: string[] = [];
    if (product.mergedIntoProductId) {
      warnings.push(
        `⚠️ Este producto fue fusionado con ID ${product.mergedIntoProductId}. Reabilitar puede causar duplicidades.`
      );
    }

    // 3. Registrar reenablement en DisabledEntityHistory
    const history = await client.models.DisabledEntityHistory.list({
      filter: {
        and: [
          { entityId: { eq: productId } },
          { entityType: { eq: 'Product' } },
        ],
      },
    });

    if (history.data.length > 0) {
      const lastRecord = history.data[0];
      
      await client.models.DisabledEntityHistory.update({
        historyId: lastRecord.historyId,
        reenabledBy: userId,
        reenabledAt: new Date(),
        reenableReason: reason || 'Manual re-enablement',
      });
    }

    // 4. Actualizar producto
    await client.models.Product.update({
      idProduct: productId,
      isEnabled: true,
      lastEnabledAt: new Date(),
    });

    // 5. Registrar en AuditLog
    await client.models.AuditLog.create({
      logId: `AL-${Date.now()}`,
      userId,
      action: 'ENABLED',
      tableName: 'Product',
      recordId: productId,
      timestamp: new Date(),
      reason: reason || 'Manual re-enablement',
    });

    return {
      success: true,
      message: `✅ Producto "${product.name}" habilitado correctamente`,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('Error habilitando producto:', error);
    return {
      success: false,
      message: 'Error al habilitar el producto',
    };
  }
}
```

---

### Archivo 4: `src/actions/merge-products.ts`

**Propósito:** Fusión completa y segura

```typescript
'use server';

// src/actions/merge-products.ts

import { generateClient } from 'aws-amplify/api';
import type { Schema } from '@/../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'apiKey' });

export async function validateMerge(
  primaryId: number,
  duplicateId: number
): Promise<{
  canMerge: boolean;
  warnings: string[];
  conflicts: string[];
  impactedDocuments: number;
}> {
  const warnings: string[] = [];
  const conflicts: string[] = [];
  
  // Obtener ambos productos
  const primary = await client.models.Product.get(
    { idProduct: primaryId },
    { selectionSet: ['idProduct', 'price', 'code', 'name'] }
  );
  
  const duplicate = await client.models.Product.get(
    { idProduct: duplicateId },
    { selectionSet: ['idProduct', 'price', 'code', 'name'] }
  );

  if (!primary || !duplicate) {
    conflicts.push('Uno o ambos productos no existen');
    return { canMerge: false, warnings, conflicts, impactedDocuments: 0 };
  }

  // Verificar si ya fueron merged
  if (duplicate.mergedIntoProductId) {
    conflicts.push(`El producto ya fue fusionado con ${duplicate.mergedIntoProductId}`);
  }

  // Verificar diferencia de precios
  if (primary.price && duplicate.price) {
    const priceDiff = Math.abs(primary.price - duplicate.price) / primary.price * 100;
    if (priceDiff > 10) {
      warnings.push(
        `⚠️ Los precios difieren en ${priceDiff.toFixed(1)}%: $${primary.price} vs $${duplicate.price}`
      );
    }
  }

  // Contar documentos impactados
  const documentItems = await client.models.DocumentItem.list({
    filter: { productId: { eq: duplicateId } },
  });

  const impactedDocuments = new Set(
    documentItems.data.map(item => item.documentId)
  ).size;

  if (impactedDocuments > 0) {
    warnings.push(`${impactedDocuments} documentos serán redirigidos`);
  }

  return {
    canMerge: conflicts.length === 0,
    warnings,
    conflicts,
    impactedDocuments,
  };
}

export async function mergeProducts(
  primaryId: number,
  duplicateId: number,
  userId: number = 1
): Promise<{
  success: boolean;
  message: string;
  summary?: {
    barcodesMerged: number;
    kardexMerged: number;
    documentsMerged: number;
    stocksMerged: number;
  };
}> {
  try {
    // 1. Validar merge
    const validation = await validateMerge(primaryId, duplicateId);

    if (!validation.canMerge) {
      return {
        success: false,
        message: `No se puede fusionar: ${validation.conflicts.join(', ')}`,
      };
    }

    console.log(`🔄 Iniciando merge: ${primaryId} ← ${duplicateId}`);

    let barcodeCount = 0;
    let kardexCount = 0;
    let documentCount = 0;
    let stockCount = 0;

    // 2. Fusionar barcodes
    const barcodes = await client.models.Barcode.list({
      filter: { productId: { eq: duplicateId } },
    });

    for (const barcode of barcodes.data) {
      await client.models.Barcode.update({
        productId: primaryId,
        value: barcode.value,
      });
      barcodeCount++;
    }

    // 3. Redirigir kardex
    const kardexEntries = await client.models.Kardex.list({
      filter: { productId: { eq: duplicateId } },
    });

    for (const entry of kardexEntries.data) {
      await client.models.Kardex.update({
        kardexId: entry.kardexId,
        productId: primaryId,
      });
      kardexCount++;
    }

    // 4. Redirigir documentos
    const documentItems = await client.models.DocumentItem.list({
      filter: { productId: { eq: duplicateId } },
    });

    const documentIds = new Set<number>();
    for (const item of documentItems.data) {
      await client.models.DocumentItem.update({
        documentItemId: item.documentItemId,
        productId: primaryId,
      });
      if (item.documentId) {
        documentIds.add(item.documentId);
      }
      documentCount++;
    }

    // 5. Fusionar stocks
    const stocks = await client.models.Stock.list({
      filter: { productId: { eq: duplicateId } },
    });

    for (const stock of stocks.data) {
      // Buscar si existe stock del primario en el mismo warehouse
      const existingStock = await client.models.Stock.get(
        {
          productId: primaryId,
          warehouseId: stock.warehouseId,
        },
        { selectionSet: ['quantity'] }
      );

      if (existingStock) {
        // Sumar cantidades
        await client.models.Stock.update({
          productId: primaryId,
          warehouseId: stock.warehouseId,
          quantity: (existingStock.quantity || 0) + (stock.quantity || 0),
        });
      } else {
        // Copiar stock
        await client.models.Stock.update({
          productId: primaryId,
          warehouseId: stock.warehouseId,
          quantity: stock.quantity,
        });
      }
      stockCount++;
    }

    // 6. Deshabilitar producto duplicado
    await client.models.Product.update({
      idProduct: duplicateId,
      isEnabled: false,
      mergedIntoProductId: primaryId,
      disabledReason: 'MERGED_WITH_PRIMARY',
      disabledAt: new Date(),
    });

    // 7. Registrar en ProductMergeHistory
    const mergeId = `PM-${Date.now()}`;
    await client.models.ProductMergeHistory.create({
      mergeId,
      primaryProductId: primaryId,
      duplicateProductId: duplicateId,
      mergedBy: userId,
      mergedAt: new Date(),
      barcodesMerged: barcodeCount,
      kardexEntries: kardexCount,
      stockControlsMerged: stockCount,
      notes: `Fusionado automáticamente. ${documentCount} documentos impactados.`,
      reversible: false,
    });

    // 8. Registrar en AuditLog
    await client.models.AuditLog.create({
      logId: `AL-${Date.now()}`,
      userId,
      action: 'MERGED',
      tableName: 'Product',
      recordId: duplicateId,
      timestamp: new Date(),
      reason: `Producto fusionado en ${primaryId}`,
      relatedRecords: JSON.stringify({
        primaryProductId: primaryId,
        impactedDocuments: Array.from(documentIds),
      }),
      impactedDocuments: documentIds.size,
    });

    return {
      success: true,
      message: `✅ Productos fusionados exitosamente. ${documentIds.size} documentos actualizados.`,
      summary: {
        barcodesMerged: barcodeCount,
        kardexMerged: kardexCount,
        documentsMerged: documentCount,
        stocksMerged: stockCount,
      },
    };
  } catch (error) {
    console.error('Error en merge:', error);
    return {
      success: false,
      message: 'Error al fusionar productos',
    };
  }
}
```

---

## Fase 3️⃣: Componentes UI

### Componente 1: `ProductFiltersPanel.tsx`

```typescript
// src/components/products/ProductFiltersPanel.tsx

'use client';

import { useState } from 'react';
import * as Form from '@radix-ui/react-form';
import { Button } from '@/components/ui/button';

interface ProductFilters {
  status: 'enabled' | 'disabled' | 'all';
  reason?: string;
  dateFrom?: string;
  dateTo?: string;
  stock?: 'with' | 'without' | 'negative' | 'all';
  groupId?: number;
  searchTerm?: string;
  showCandidates?: boolean;
  showHistory?: boolean;
}

interface ProductFiltersPanelProps {
  onApply: (filters: ProductFilters) => void;
  onClear: () => void;
}

export function ProductFiltersPanel({ onApply, onClear }: ProductFiltersPanelProps) {
  const [filters, setFilters] = useState<ProductFilters>({
    status: 'enabled',
  });

  const [expanded, setExpanded] = useState(false);

  const handleApply = () => {
    onApply(filters);
  };

  const handleClear = () => {
    setFilters({ status: 'enabled' });
    onClear();
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      {/* Barra Rápida */}
      <div className="flex gap-3 items-center mb-4">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
          className="px-3 py-2 border rounded"
        >
          <option value="enabled">Habilitados</option>
          <option value="disabled">Deshabilitados</option>
          <option value="all">Todos</option>
        </select>

        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-2 border rounded hover:bg-gray-100"
        >
          {expanded ? '▼' : '▶'} Filtros Avanzados
        </button>

        <input
          type="text"
          placeholder="Buscar por nombre/código..."
          value={filters.searchTerm || ''}
          onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
          className="flex-1 px-3 py-2 border rounded"
        />

        <Button onClick={handleApply}>Aplicar</Button>
      </div>

      {/* Filtros Expandibles */}
      {expanded && (
        <div className="border-t pt-4 grid grid-cols-2 gap-4">
          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium mb-2">Motivo de Deshabilitación</label>
            <select
              value={filters.reason || ''}
              onChange={(e) => setFilters({ ...filters, reason: e.target.value || undefined })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">Todos</option>
              <option value="Accidental">Accidental</option>
              <option value="Duplicate">Duplicado</option>
              <option value="Obsolete">Obsoleto</option>
              <option value="Temporary">Temporal</option>
            </select>
          </div>

          {/* Rango de Fecha */}
          <div>
            <label className="block text-sm font-medium mb-2">Rango de Deshabilitación</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
            </div>
          </div>

          {/* Stock */}
          <div>
            <label className="block text-sm font-medium mb-2">Stock</label>
            <select
              value={filters.stock || 'all'}
              onChange={(e) => setFilters({ ...filters, stock: e.target.value as any })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="all">Todos</option>
              <option value="with">Con stock</option>
              <option value="without">Sin stock</option>
              <option value="negative">Stock negativo</option>
            </select>
          </div>

          {/* Opciones */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.showCandidates || false}
                onChange={(e) => setFilters({ ...filters, showCandidates: e.target.checked })}
              />
              <span className="text-sm">Mostrar candidatos a duplicado</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.showHistory || false}
                onChange={(e) => setFilters({ ...filters, showHistory: e.target.checked })}
              />
              <span className="text-sm">Mostrar histórico de cambios</span>
            </label>
          </div>
        </div>
      )}

      {/* Botones de Acción */}
      <div className="flex gap-2 mt-4 border-t pt-4">
        <Button onClick={handleClear} variant="outline">
          Limpiar Filtros
        </Button>
      </div>
    </div>
  );
}
```

---

### Componente 2: `DisableProductModal.tsx`

```typescript
// src/components/products/DisableProductModal.tsx

'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { disableProduct } from '@/actions/disable-product';

interface DisableProductModalProps {
  productId: number;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DisableProductModal({
  productId,
  productName,
  open,
  onOpenChange,
  onSuccess,
}: DisableProductModalProps) {
  const [reason, setReason] = useState<'Accidental' | 'Duplicate' | 'Obsolete' | 'Temporary'>(
    'Accidental'
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await disableProduct(productId, reason, notes);

      if (result.success) {
        alert(result.message);
        onOpenChange(false);
        onSuccess?.();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      alert('Error al deshabilitar el producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-md">
        <Dialog.Header>
          <Dialog.Title>Deshabilitar Producto</Dialog.Title>
        </Dialog.Header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="font-medium">{productName}</p>
            <p className="text-sm text-gray-500">ID: {productId}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Motivo</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full px-3 py-2 border rounded"
              disabled={loading}
            >
              <option value="Accidental">Accidental</option>
              <option value="Duplicate">Duplicado</option>
              <option value="Obsolete">Obsoleto</option>
              <option value="Temporary">Temporal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notas (Opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Añade información adicional..."
              className="w-full px-3 py-2 border rounded"
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Deshabilitando...' : 'Deshabilitar'}
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
```

---

## 📋 Testing

### Tests para `product-service.ts`

```typescript
// src/services/__tests__/product-service.test.ts

import { levenshteinDistance, calculateSimilarity } from '@/services/product-service';

describe('Product Service', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('TORNILLO', 'TORNILLO')).toBe(0);
    });

    it('should calculate distance correctly', () => {
      expect(levenshteinDistance('TORNILLO', 'TORNILO')).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('TEST', '')).toBe(4);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      expect(calculateSimilarity('TORNILLO', 'TORNILLO')).toBe(1.0);
    });

    it('should return correct similarity percentage', () => {
      const sim = calculateSimilarity('TORNILLO', 'TORNILO');
      expect(sim).toBeGreaterThan(0.8);
    });
  });
});
```

---

## ✅ Checklist de Deployment

### Pre-Deployment
- [ ] `amplify push` exitoso
- [ ] BD sin cambios (verificado en consola)
- [ ] Nuevas tablas creadas en DynamoDB
- [ ] Schema compilado sin errores

### Backend Services
- [ ] `product-service.ts` completado
- [ ] `disable-product.ts` completado
- [ ] `enable-product.ts` completado
- [ ] `merge-products.ts` completado
- [ ] Tests unitarios pasen

### Frontend Components
- [ ] `ProductFiltersPanel.tsx` completado
- [ ] `DisableProductModal.tsx` completado
- [ ] `EnableProductModal.tsx` completado
- [ ] `MergeProductsModal.tsx` completado
- [ ] Estilos aplicados (Tailwind + Radix UI)

### Integration Tests
- [ ] Filtros funcionan correctamente
- [ ] Deshabilitación registra en DB
- [ ] Historial se muestra correctamente
- [ ] Merge consolida datos

### Production
- [ ] Backup de BD realizado
- [ ] Deploy en staging exitoso
- [ ] Usuarios capacitados
- [ ] Monitoreo activado (24/7 - primer mes)

---

_Documento: GUIA_IMPLEMENTACION_TECNICA.md_  
_Versión: 1.0_
