'use client';

/**
 * DisableProductModal - Modal para desabilitar producto
 * 
 * Propósito:
 * - Interfaz de confirmación para deshabilitar producto
 * - Pedir motivo y notas
 * - Ejecutar disableProduct action
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { disableProduct } from '@/actions/disable-product-action';

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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await disableProduct(productId, reason, notes);

      if (result.success) {
        alert(result.message);
        setReason('Accidental');
        setNotes('');
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Error al deshabilitar el producto');
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
          <h2 className="text-lg font-semibold">⚠️ Deshabilitar Producto</h2>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Información del Producto */}
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded">
            <p className="font-medium text-sm">{productName}</p>
            <p className="text-xs text-gray-500">ID: {productId}</p>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium mb-2">Motivo de Deshabilitación</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
              disabled={loading}
            >
              <option value="Accidental">⚡ Accidental (Error durante creación)</option>
              <option value="Duplicate">🔀 Duplicado (Es copia de otro)</option>
              <option value="Obsolete">🗑️ Obsoleto (Ya no se vende)</option>
              <option value="Temporary">⏱️ Temporal (Desactivar temporalmente)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {reason === 'Accidental' && 'Se presionó desactivado por error'}
              {reason === 'Duplicate' && 'Existe otro producto igual'}
              {reason === 'Obsolete' && 'Producto descontinuado'}
              {reason === 'Temporary' && 'Se reactivará más adelante'}
            </p>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium mb-2">Notas (Opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Añade información adicional para futuras referencias..."
              className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
              rows={3}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Máximo 500 caracteres - {notes.length}/500
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
            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
              {loading ? '⏳ Deshabilitando...' : '❌ Deshabilitar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
