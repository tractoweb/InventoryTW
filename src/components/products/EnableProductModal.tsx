'use client';

/**
 * EnableProductModal - Modal para rehabilitar producto
 * 
 * Propósito:
 * - Interfaz de confirmación para rehabilitar producto
 * - Mostrar advertencias si fue merged
 * - Ejecutar enableProduct action
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { enableProduct } from '@/actions/enable-product-action';

interface EnableProductModalProps {
  productId: number;
  productName: string;
  mergedIntoProductId?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EnableProductModal({
  productId,
  productName,
  mergedIntoProductId,
  open,
  onOpenChange,
  onSuccess,
}: EnableProductModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await enableProduct(productId, reason || undefined);

      if (result.success) {
        alert(result.message);
        if (result.warnings && result.warnings.length > 0) {
          console.warn('Advertencias:', result.warnings);
        }
        setReason('');
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Error al habilitar el producto');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="border-b p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold">✅ Rehabilitar Producto</h2>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Información del Producto */}
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded">
            <p className="font-medium text-sm">{productName}</p>
            <p className="text-xs text-gray-500">ID: {productId}</p>
          </div>

          {/* Advertencia si fue merged */}
          {mergedIntoProductId && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded text-sm">
              <p className="font-medium">⚠️ Advertencia Importante</p>
              <p className="mt-1">
                Este producto fue fusionado con ID <strong>{mergedIntoProductId}</strong>. 
                Rehabilitar puede causar duplicidades en tu inventario.
              </p>
              <p className="mt-2 text-xs">
                ¿Estás seguro de que deseas reactivar este producto?
              </p>
            </div>
          )}

          {/* Razón de Rehabilitación */}
          <div>
            <label className="block text-sm font-medium mb-2">Razón de Rehabilitación</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ejemplo: Se necesita nuevamente para stock..."
              className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              Máximo 500 caracteres - {reason.length}/500
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end border-t pt-4 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className={mergedIntoProductId ? 'bg-orange-600 hover:bg-orange-700' : ''}
            >
              {loading ? '⏳ Habilitando...' : '✅ Habilitar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
