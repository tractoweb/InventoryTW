'use client';

/**
 * Página: Maestro Productos Mejorado
 * 
 * Propósito:
 * - Página principal para gestión de productos
 * - Integra filtros, tabla, y gestión de duplicados
 * - Ejemplo de cómo usar todos los componentes
 */

import { useState, useEffect } from 'react';
import { ProductFiltersPanel, type ProductFilters } from '@/components/products/ProductFiltersPanel';
import { ProductTableEnhanced } from '@/components/products/ProductTableEnhanced';
import { DuplicateDetectionPanel } from '@/components/products/DuplicateDetectionPanel';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/hooks/useProducts';

// En una aplicación real, estos datos vendrían de tu BD
const DEMO_PRODUCTS = [
  {
    idProduct: 1,
    name: 'TORNILLO M8',
    code: 'PRD-001',
    isEnabled: true,
    price: 0.5,
    stock: [{ quantity: 100 }],
  },
  {
    idProduct: 2,
    name: 'TORNILLO M8',
    code: 'PRD-002',
    isEnabled: false,
    disabledReason: 'Duplicate',
    disabledAt: new Date(Date.now() - 86400000).toISOString(),
    mergedIntoProductId: 1,
    price: 0.5,
    stock: [{ quantity: 0 }],
  },
  {
    idProduct: 3,
    name: 'CLAVO 2 PULGADAS',
    code: 'PRD-003',
    isEnabled: true,
    price: 0.25,
    stock: [{ quantity: 500 }],
  },
  {
    idProduct: 4,
    name: 'ARANDELA GRANDE',
    code: 'PRD-004',
    isEnabled: false,
    disabledReason: 'Accidental',
    disabledAt: new Date(Date.now() - 3600000).toISOString(),
    price: 1.0,
    stock: [{ quantity: 50 }],
  },
  {
    idProduct: 5,
    name: 'CABLE USB',
    code: 'PRD-005',
    isEnabled: true,
    price: 5.0,
    stock: [{ quantity: -10 }], // Stock negativo
  },
];

interface MaestroProductosPageProps {
  productGroups?: Array<{ id: number; name: string }>;
}

export function MaestroProductosPage({ 
  productGroups = [] 
}: MaestroProductosPageProps) {
  const [activeTab, setActiveTab] = useState<'productos' | 'duplicados'>('productos');
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    products,
    allProducts,
    filters,
    loading,
    counts,
    applyFilters,
    clearFilters,
  } = useProducts(DEMO_PRODUCTS);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  const handleApplyFilters = (newFilters: ProductFilters) => {
    applyFilters(newFilters);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">📦 Maestro Productos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Total: <strong>{counts.total}</strong> productos
            {' '}
            ({counts.enabled} habilitados, {counts.disabled} deshabilitados)
          </p>
        </div>
        <Button 
          onClick={handleRefresh}
          variant="outline"
          className="whitespace-nowrap"
        >
          🔄 Actualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b dark:border-gray-700">
        <button
          onClick={() => setActiveTab('productos')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === 'productos'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          📋 Productos ({counts.filtered})
        </button>
        <button
          onClick={() => setActiveTab('duplicados')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === 'duplicados'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          🔀 Gestión de Duplicados
        </button>
      </div>

      {/* TAB 1: PRODUCTOS */}
      {activeTab === 'productos' && (
        <div className="space-y-4">
          {/* Filtros */}
          <ProductFiltersPanel
            onApply={handleApplyFilters}
            onClear={clearFilters}
            productGroups={productGroups}
          />

          {/* Información de Filtros */}
          {Object.values(filters).some(v => v && v !== 'enabled' && v !== 'all') && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded text-sm">
              <strong>💡 Filtros activos:</strong> Mostrando {counts.filtered} de {counts.total} productos
              {filters.status && ` • Estado: ${filters.status}`}
              {filters.reason && ` • Motivo: ${filters.reason}`}
              {filters.searchTerm && ` • Búsqueda: "${filters.searchTerm}"`}
            </div>
          )}

          {/* Tabla */}
          <ProductTableEnhanced
            key={refreshKey}
            products={products}
            loading={loading}
            onProductsChange={handleRefresh}
          />
        </div>
      )}

      {/* TAB 2: DUPLICADOS */}
      {activeTab === 'duplicados' && (
        <div>
          <DuplicateDetectionPanel />
        </div>
      )}

      {/* Footer Info */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
        <p className="font-medium mb-2">ℹ️ Información</p>
        <ul className="space-y-1 text-xs">
          <li>✅ Habilitados: {counts.enabled}</li>
          <li>❌ Deshabilitados: {counts.disabled}</li>
          <li>🔗 Merged: {counts.merged}</li>
          <li>📊 Mostrando: {counts.filtered} de {counts.total}</li>
        </ul>
      </div>
    </div>
  );
}

export default MaestroProductosPage;
