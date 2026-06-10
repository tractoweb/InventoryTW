'use client';

/**
 * ProductFiltersPanel - Filtros avanzados para Maestro Productos
 * 
 * Propósito:
 * - Interfaz compleja para filtrar productos por múltiples criterios
 * - Mostrar: Estado, Motivo, Fecha, Stock, Grupo
 * - Opciones avanzadas: Candidatos, Histórico
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface ProductFilters {
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
  productGroups?: Array<{ id: number; name: string }>;
}

export function ProductFiltersPanel({ 
  onApply, 
  onClear,
  productGroups = [] 
}: ProductFiltersPanelProps) {
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

  const handleStatusChange = (value: string) => {
    setFilters({ ...filters, status: value as 'enabled' | 'disabled' | 'all' });
  };

  const handleReasonChange = (value: string) => {
    setFilters({ ...filters, reason: value || undefined });
  };

  const handleStockChange = (value: string) => {
    setFilters({ ...filters, stock: value as 'with' | 'without' | 'negative' | 'all' });
  };

  const handleSearchChange = (value: string) => {
    setFilters({ ...filters, searchTerm: value || undefined });
  };

  const handleDateFromChange = (value: string) => {
    setFilters({ ...filters, dateFrom: value || undefined });
  };

  const handleDateToChange = (value: string) => {
    setFilters({ ...filters, dateTo: value || undefined });
  };

  const handleGroupChange = (value: string) => {
    setFilters({ ...filters, groupId: value ? parseInt(value) : undefined });
  };

  const handleShowCandidatesChange = (checked: boolean) => {
    setFilters({ ...filters, showCandidates: checked });
  };

  const handleShowHistoryChange = (checked: boolean) => {
    setFilters({ ...filters, showHistory: checked });
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
      {/* Barra Rápida */}
      <div className="flex gap-3 items-center mb-4 flex-wrap">
        {/* Estado */}
        <select
          value={filters.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-2 border rounded bg-white dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="enabled">✅ Habilitados</option>
          <option value="disabled">❌ Deshabilitados</option>
          <option value="all">📋 Todos</option>
        </select>

        {/* Botón Expandir */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-800 dark:border-gray-700 flex items-center gap-2"
        >
          {expanded ? '▼' : '▶'} 
          <span className="text-sm">Filtros Avanzados</span>
        </button>

        {/* Búsqueda */}
        <input
          type="text"
          placeholder="Buscar por nombre/código/PLU..."
          value={filters.searchTerm || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
        />

        {/* Botones de Acción */}
        <Button onClick={handleApply} className="whitespace-nowrap">
          🔍 Aplicar
        </Button>
      </div>

      {/* Filtros Expandibles */}
      {expanded && (
        <div className="border-t pt-4 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Motivo de Deshabilitación */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Motivo
              </label>
              <select
                value={filters.reason || ''}
                onChange={(e) => handleReasonChange(e.target.value)}
                className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="">Todos los motivos</option>
                <option value="Accidental">⚡ Accidental</option>
                <option value="Duplicate">🔀 Duplicado</option>
                <option value="Obsolete">🗑️ Obsoleto</option>
                <option value="Temporary">⏱️ Temporal</option>
                <option value="MERGED_WITH_PRIMARY">🔗 Merged</option>
              </select>
            </div>

            {/* Rango de Fecha */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Deshabilitado desde
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Deshabilitado hasta
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
              />
            </div>

            {/* Stock */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Stock
              </label>
              <select
                value={filters.stock || 'all'}
                onChange={(e) => handleStockChange(e.target.value)}
                className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="all">Todos</option>
                <option value="with">📦 Con stock</option>
                <option value="without">📭 Sin stock</option>
                <option value="negative">⚠️ Stock negativo</option>
              </select>
            </div>

            {/* Grupo de Producto */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Grupo de Producto
              </label>
              <select
                value={filters.groupId || ''}
                onChange={(e) => handleGroupChange(e.target.value)}
                className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="">Todos los grupos</option>
                {productGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Opciones Avanzadas */}
            <div className="space-y-2">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Opciones
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showCandidates || false}
                  onChange={(e) => handleShowCandidatesChange(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">🔀 Candidatos a duplicado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showHistory || false}
                  onChange={(e) => handleShowHistoryChange(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">📜 Histórico de cambios</span>
              </label>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-2 mt-4 border-t pt-4 dark:border-gray-700">
            <Button onClick={handleClear} variant="outline">
              🔄 Limpiar Filtros
            </Button>
            <Button onClick={handleApply}>
              ✅ Aplicar Filtros
            </Button>
          </div>
        </div>
      )}

      {/* Estado de Filtros Activos */}
      {(filters.reason || filters.dateFrom || filters.dateTo || filters.stock !== 'all' || filters.groupId) && (
        <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
          💡 {Object.values(filters).filter(v => v && v !== 'enabled' && v !== 'all').length} filtro(s) activo(s)
        </div>
      )}
    </div>
  );
}
