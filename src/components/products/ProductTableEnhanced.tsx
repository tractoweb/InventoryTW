'use client';

/**
 * ProductTableEnhanced - Tabla de productos con todas las características
 * 
 * Propósito:
 * - Mostrar productos con filtros aplicados
 * - Acciones: Ver historial, Deshabilitar, Habilitar, Fusionar
 * - Indicadores visuales de estado
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DisableProductModal } from './DisableProductModal';
import { EnableProductModal } from './EnableProductModal';
import { ProductHistoryModal } from './ProductHistoryModal';

interface Product {
  idProduct: number;
  name: string;
  code?: string;
  isEnabled: boolean;
  disabledReason?: string;
  disabledAt?: string;
  mergedIntoProductId?: number;
  price?: number;
}

interface ProductTableEnhancedProps {
  products: Product[];
  loading?: boolean;
  onProductsChange?: () => void;
}

export function ProductTableEnhanced({
  products,
  loading = false,
  onProductsChange,
}: ProductTableEnhancedProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalType, setModalType] = useState<'disable' | 'enable' | 'history' | null>(null);

  const getStatusBadge = (product: Product) => {
    if (product.isEnabled) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">✅ Activo</span>;
    }
    
    if (product.mergedIntoProductId) {
      return (
        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
          🔗 Merged (→{product.mergedIntoProductId})
        </span>
      );
    }

    const reasonIcons: { [key: string]: string } = {
      'Accidental': '⚡',
      'Duplicate': '🔀',
      'Obsolete': '🗑️',
      'Temporary': '⏱️',
      'MERGED_WITH_PRIMARY': '🔗',
    };

    const icon = reasonIcons[product.disabledReason || ''] || '❌';
    
    return (
      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
        {icon} {product.disabledReason || 'Inactivo'}
      </span>
    );
  };

  const getDisabledDate = (product: Product) => {
    if (product.disabledAt) {
      return new Date(product.disabledAt).toLocaleDateString('es-ES');
    }
    return '-';
  };

  const handleAction = (product: Product, action: 'disable' | 'enable' | 'history') => {
    setSelectedProduct(product);
    setModalType(action);
  };

  const handleModalClose = () => {
    setModalType(null);
    setSelectedProduct(null);
    onProductsChange?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-gray-500">⏳ Cargando productos...</span>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        📭 No se encontraron productos
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-left">Deshabilitado</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.idProduct}
                  className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    !product.isEnabled ? 'bg-gray-50 dark:bg-gray-900/50' : ''
                  }`}
                >
                  {/* Código */}
                  <td className="px-4 py-3 font-mono text-xs">
                    {product.code || '-'}
                  </td>

                  {/* Nombre */}
                  <td className="px-4 py-3">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-gray-500">ID: {product.idProduct}</div>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    {getStatusBadge(product)}
                  </td>

                  {/* Motivo */}
                  <td className="px-4 py-3 text-xs">
                    {product.disabledReason || '-'}
                  </td>

                  {/* Deshabilitado */}
                  <td className="px-4 py-3 text-xs">
                    {getDisabledDate(product)}
                  </td>

                  {/* Precio */}
                  <td className="px-4 py-3 text-right font-mono">
                    {product.price ? `$${product.price.toFixed(2)}` : '-'}
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {/* Ver Historial */}
                      <button
                        onClick={() => handleAction(product, 'history')}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        title="Ver historial"
                      >
                        📜
                      </button>

                      {/* Deshabilitar */}
                      {product.isEnabled && (
                        <button
                          onClick={() => handleAction(product, 'disable')}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          title="Deshabilitar"
                        >
                          ❌
                        </button>
                      )}

                      {/* Habilitar */}
                      {!product.isEnabled && !product.mergedIntoProductId && (
                        <button
                          onClick={() => handleAction(product, 'enable')}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          title="Habilitar"
                        >
                          ✅
                        </button>
                      )}

                      {/* Merged Warning */}
                      {product.mergedIntoProductId && (
                        <div className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                          🔗 Merged
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      {selectedProduct && modalType === 'disable' && (
        <DisableProductModal
          productId={selectedProduct.idProduct}
          productName={selectedProduct.name}
          open={modalType === 'disable'}
          onOpenChange={() => handleModalClose()}
          onSuccess={() => handleModalClose()}
        />
      )}

      {selectedProduct && modalType === 'enable' && (
        <EnableProductModal
          productId={selectedProduct.idProduct}
          productName={selectedProduct.name}
          mergedIntoProductId={selectedProduct.mergedIntoProductId}
          open={modalType === 'enable'}
          onOpenChange={() => handleModalClose()}
          onSuccess={() => handleModalClose()}
        />
      )}

      {selectedProduct && modalType === 'history' && (
        <ProductHistoryModal
          productId={selectedProduct.idProduct}
          productName={selectedProduct.name}
          open={modalType === 'history'}
          onOpenChange={() => handleModalClose()}
        />
      )}
    </>
  );
}
