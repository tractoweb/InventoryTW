'use client';

/**
 * ProductHistoryModal - Modal para ver historial completo del producto
 * 
 * Propósito:
 * - Mostrar timeline de todos los cambios del producto
 * - Deshabilitaciones, rehabilitaciones, fusiones
 * - Audit trail completo
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getProductHistory } from '@/actions/get-product-history-action';

interface ProductHistoryModalProps {
  productId: number;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductHistoryModal({
  productId,
  productName,
  open,
  onOpenChange,
}: ProductHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getProductHistory(productId);
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError('Error cargando historial');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full">
        {/* Header */}
        <div className="border-b p-4 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">📜 Historial del Producto</h2>
            <p className="text-sm text-gray-500">{productName} (ID: {productId})</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-auto space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="text-gray-500">⏳ Cargando historial...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {data && !loading && (
            <div className="space-y-4">
              {/* Estado Actual */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium">📌 Estado Actual</p>
                <p className="text-sm mt-1">
                  Estado: {data.product.isEnabled ? '✅ Habilitado' : '❌ Deshabilitado'}
                </p>
                {data.product.disabledReason && (
                  <p className="text-sm">
                    Motivo: <strong>{data.product.disabledReason}</strong>
                  </p>
                )}
                {data.product.mergedIntoProductId && (
                  <p className="text-sm text-orange-700">
                    🔗 Merged into product {data.product.mergedIntoProductId}
                  </p>
                )}
              </div>

              {/* Timeline */}
              {data.timeline && data.timeline.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">⏱️ Línea de Tiempo</p>
                  <div className="space-y-2 border-l-2 border-gray-300 dark:border-gray-700 pl-4 ml-2">
                    {data.timeline.map((event: any, idx: number) => (
                      <div key={idx} className="relative -ml-6">
                        <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-gray-900 absolute top-1" />
                        <div className="ml-4 bg-gray-50 dark:bg-gray-800 p-2 rounded text-sm">
                          <div className="font-medium">
                            {event.type === 'CREATED' && '✨ Creado'}
                            {event.type === 'DISABLED' && '❌ Deshabilitado'}
                            {event.type === 'ENABLED' && '✅ Habilitado'}
                            {event.type === 'MERGE_PRIMARY' && '🔗 Producto fusionado en este'}
                            {event.type === 'MERGE_DUPLICATE' && '🔗 Fusionado en otro'}
                            {event.type === 'UPDATED' && '✏️ Actualizado'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {event.description}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(event.date).toLocaleString('es-ES')}
                          </div>
                          {event.details && (
                            <div className="text-xs bg-gray-100 dark:bg-gray-700 p-1 mt-1 rounded">
                              {typeof event.details === 'string' 
                                ? event.details 
                                : JSON.stringify(event.details, null, 2).slice(0, 100)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm text-center py-4">
                  Sin eventos en el historial
                </div>
              )}

              {/* Candidatos a Duplicado */}
              {data.duplicateCandidates && data.duplicateCandidates.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm font-medium">🔀 Candidatos a Duplicado</p>
                  <ul className="space-y-1 mt-2 text-sm">
                    {data.duplicateCandidates.map((c: any, idx: number) => (
                      <li key={idx}>
                        {c.primaryProductId === productId ? '→' : '←'} 
                        {' '}ID: {c.primaryProductId === productId ? c.duplicateProductId : c.primaryProductId}
                        {' '}({c.matchType}, {(c.confidence * 100).toFixed(0)}%)
                        {' - '} 
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-700 px-2 py-1 rounded">
                          {c.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 dark:border-gray-700 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
