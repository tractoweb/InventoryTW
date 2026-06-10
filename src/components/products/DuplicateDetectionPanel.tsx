'use client';

/**
 * DuplicateDetectionPanel - Panel para gestionar duplicados detectados
 * 
 * Propósito:
 * - Ver candidatos a duplicado pendientes
 * - Confirmar o rechazar candidatos
 * - Fusionar desde aquí directamente
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { runFullDuplicateDetection, getPendingDuplicateCandidates, confirmDuplicateCandidate, rejectDuplicateCandidate } from '@/services/product-service';
import { MergeProductsModal } from './MergeProductsModal';

interface DuplicateCandidate {
  candidateId: string;
  primaryProductId: number;
  duplicateProductId: number;
  matchType: string;
  confidence: number;
  reason?: string;
  status?: string;
}

export function DuplicateDetectionPanel() {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeModal, setMergeModal] = useState<{
    open: boolean;
    primary?: number;
    duplicate?: number;
    primaryName?: string;
    duplicateName?: string;
  }>({ open: false });

  const loadCandidates = async () => {
    setLoading(true);
    setError(null);

    try {
      const candidates = await getPendingDuplicateCandidates();
      setCandidates(candidates as any);
    } catch (e) {
      setError('Error cargando candidatos');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const handleRunDetection = async () => {
    setLoading(true);
    setError(null);

    try {
      await runFullDuplicateDetection();
      await loadCandidates();
    } catch (e) {
      setError('Error ejecutando detección');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (candidateId: string) => {
    try {
      const result = await confirmDuplicateCandidate(candidateId);
      if (result.success) {
        await loadCandidates();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (candidateId: string) => {
    try {
      const result = await rejectDuplicateCandidate(candidateId, 'User rejected');
      if (result.success) {
        await loadCandidates();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pending = candidates.filter(c => c.status === 'PENDING' || !c.status);
  const confirmed = candidates.filter(c => c.status === 'CONFIRMED');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">🔀 Gestión de Duplicados</h2>
        <Button 
          onClick={handleRunDetection} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? '⏳ Detectando...' : '🔍 Ejecutar Detección'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
          <p className="text-2xl font-bold text-blue-700">{candidates.length}</p>
          <p className="text-sm text-blue-600">Total Detectados</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
          <p className="text-2xl font-bold text-yellow-700">{pending.length}</p>
          <p className="text-sm text-yellow-600">Pendientes</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
          <p className="text-2xl font-bold text-green-700">{confirmed.length}</p>
          <p className="text-sm text-green-600">Confirmados</p>
        </div>
      </div>

      {/* Pendientes */}
      {pending.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 border-b dark:border-gray-700">
            <h3 className="font-medium">⏳ Pendientes de Revisión ({pending.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">Confianza</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Primario</th>
                  <th className="px-4 py-2 text-left">Duplicado</th>
                  <th className="px-4 py-2 text-left">Motivo</th>
                  <th className="px-4 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((candidate) => (
                  <tr key={candidate.candidateId} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        candidate.confidence > 0.95 ? 'bg-red-100 text-red-700' :
                        candidate.confidence > 0.85 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {(candidate.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{candidate.matchType}</td>
                    <td className="px-4 py-2">ID: {candidate.primaryProductId}</td>
                    <td className="px-4 py-2">ID: {candidate.duplicateProductId}</td>
                    <td className="px-4 py-2 text-xs">{candidate.reason}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(candidate.candidateId)}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        ✗
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(candidate.candidateId)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setMergeModal({
                          open: true,
                          primary: candidate.primaryProductId,
                          duplicate: candidate.duplicateProductId,
                          primaryName: `Producto ${candidate.primaryProductId}`,
                          duplicateName: `Producto ${candidate.duplicateProductId}`,
                        })}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        🔗
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmados */}
      {confirmed.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 border-b dark:border-gray-700">
            <h3 className="font-medium">✅ Confirmados y Listos para Fusionar ({confirmed.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">Primario</th>
                  <th className="px-4 py-2 text-left">Duplicado</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Acción</th>
                </tr>
              </thead>
              <tbody>
                {confirmed.map((candidate) => (
                  <tr key={candidate.candidateId} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-2 font-mono">P{candidate.primaryProductId}</td>
                    <td className="px-4 py-2 font-mono">P{candidate.duplicateProductId}</td>
                    <td className="px-4 py-2 text-xs">{candidate.matchType}</td>
                    <td className="px-4 py-2">
                      <Button
                        size="sm"
                        onClick={() => setMergeModal({
                          open: true,
                          primary: candidate.primaryProductId,
                          duplicate: candidate.duplicateProductId,
                          primaryName: `Producto ${candidate.primaryProductId}`,
                          duplicateName: `Producto ${candidate.duplicateProductId}`,
                        })}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        🔗 Fusionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && pending.length === 0 && confirmed.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          ✅ No hay candidatos a duplicado pendientes
        </div>
      )}

      {/* Merge Modal */}
      {mergeModal.open && mergeModal.primary && mergeModal.duplicate && (
        <MergeProductsModal
          primaryProductId={mergeModal.primary}
          primaryProductName={mergeModal.primaryName || `Producto ${mergeModal.primary}`}
          duplicateProductId={mergeModal.duplicate}
          duplicateProductName={mergeModal.duplicateName || `Producto ${mergeModal.duplicate}`}
          open={mergeModal.open}
          onOpenChange={(open) => {
            if (!open) {
              setMergeModal({ open: false });
              loadCandidates();
            }
          }}
          onSuccess={() => {
            setMergeModal({ open: false });
            loadCandidates();
          }}
        />
      )}
    </div>
  );
}
