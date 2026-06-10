'use client';

/**
 * MergeProductsModal - Modal para fusionar productos
 * 
 * Propósito:
 * - Interfaz de 3 pasos para fusionar productos
 * - Paso 1: Validación y advertencias
 * - Paso 2: Resumen de cambios
 * - Paso 3: Confirmación final y ejecución
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { validateMerge, mergeProducts } from '@/actions/merge-products-action';

interface MergeProductsModalProps {
  primaryProductId: number;
  primaryProductName: string;
  duplicateProductId: number;
  duplicateProductName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MergeProductsModal({
  primaryProductId,
  primaryProductName,
  duplicateProductId,
  duplicateProductName,
  open,
  onOpenChange,
  onSuccess,
}: MergeProductsModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  const handleValidate = async () => {
    setLoading(true);
    setError(null);

    try {
      const v = await validateMerge(primaryProductId, duplicateProductId);
      setValidation(v);

      if (v.canMerge) {
        setStep(2);
      } else {
        setError(`No se puede fusionar: ${v.conflicts.join(', ')}`);
      }
    } catch (e) {
      setError('Error validando merge');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteMerge = async () => {
    setLoading(true);
    setError(null);

    try {
      const r = await mergeProducts(primaryProductId, duplicateProductId);
      setResult(r);

      if (r.success) {
        setStep(3);
      } else {
        setError(r.message);
      }
    } catch (e) {
      setError('Error ejecutando merge');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (step === 3 && result?.success) {
      onOpenChange(false);
      setStep(1);
      setValidation(null);
      setResult(null);
      onSuccess?.();
    } else {
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full">
        {/* Header */}
        <div className="border-b p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold">🔗 Fusionar Productos</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Paso {step} de 3
          </p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-96 overflow-auto">
          {/* PASO 1: Validación */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Se fusionará <strong>{duplicateProductName}</strong> (ID: {duplicateProductId}) 
                  en <strong>{primaryProductName}</strong> (ID: {primaryProductId})
                </p>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}

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
                  onClick={handleValidate}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? '⏳ Validando...' : '👉 Continuar'}
                </Button>
              </div>
            </div>
          )}

          {/* PASO 2: Resumen */}
          {step === 2 && validation && (
            <div className="space-y-4">
              {/* Advertencias */}
              {validation.warnings.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded">
                  <p className="font-medium text-sm text-yellow-900 dark:text-yellow-100 mb-2">
                    ⚠️ Advertencias
                  </p>
                  <ul className="space-y-1">
                    {validation.warnings.map((w: string, i: number) => (
                      <li key={i} className="text-sm text-yellow-800 dark:text-yellow-200">
                        • {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resumen de Cambios */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border dark:border-gray-700">
                <p className="font-medium text-sm mb-2">📋 Resumen de Cambios</p>
                <ul className="space-y-1 text-sm">
                  <li>📄 <strong>{validation.impactedDocuments}</strong> documento(s) serán redirigido(s)</li>
                  <li>🔀 Los barcodes se transferirán al producto primario</li>
                  <li>📊 El kardex se consolidará en el primario</li>
                  <li>📦 Los stocks se sumarán</li>
                  <li>❌ El producto {duplicateProductId} quedará deshabilitado</li>
                </ul>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 justify-end border-t pt-4 dark:border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                  disabled={loading}
                >
                  ← Atrás
                </Button>
                <Button
                  onClick={handleExecuteMerge}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {loading ? '⏳ Fusionando...' : '🔗 Fusionar Ahora'}
                </Button>
              </div>
            </div>
          )}

          {/* PASO 3: Resultado */}
          {step === 3 && result && (
            <div className="space-y-4">
              {result.success ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded">
                  <p className="font-medium text-green-900 dark:text-green-100 mb-2">
                    ✅ Fusión Exitosa
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {result.message}
                  </p>
                </div>
              ) : (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded">
                  <p className="font-medium text-red-900 dark:text-red-100 mb-2">
                    ❌ Error en Fusión
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {result.message}
                  </p>
                </div>
              )}

              {result.summary && (
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border dark:border-gray-700">
                  <p className="font-medium text-sm mb-2">📊 Resumen de Cambios Realizados</p>
                  <ul className="space-y-1 text-sm">
                    <li>🔀 Barcodes: <strong>{result.summary.barcodesMerged}</strong></li>
                    <li>📚 Kardex: <strong>{result.summary.kardexMerged}</strong> entradas</li>
                    <li>📄 Documentos: <strong>{result.summary.documentsMerged}</strong></li>
                    <li>📦 Stocks: <strong>{result.summary.stocksMerged}</strong> combinados</li>
                  </ul>
                </div>
              )}

              <div className="flex gap-3 justify-end border-t pt-4 dark:border-gray-700">
                <Button
                  onClick={handleClose}
                  className={result.success ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  {result.success ? '✅ Cerrar' : 'Entendido'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
