'use client';

/**
 * Hook: useProducts
 * 
 * Propósito:
 * - Gestionar estado de productos
 * - Aplicar filtros
 * - Integrar con acciones del backend
 */

import { useState, useCallback } from 'react';

interface Product {
  idProduct: number;
  name: string;
  code?: string;
  isEnabled: boolean;
  disabledReason?: string;
  disabledAt?: string;
  mergedIntoProductId?: number;
  price?: number;
  stock?: { quantity: number }[];
}

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

export function useProducts(initialProducts: Product[] = []) {
  const [allProducts] = useState<Product[]>(initialProducts);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(initialProducts);
  const [filters, setFilters] = useState<ProductFilters>({ status: 'enabled' });
  const [loading, setLoading] = useState(false);

  /**
   * Aplica filtros a los productos
   */
  const applyFilters = useCallback((newFilters: ProductFilters) => {
    setFilters(newFilters);
    setLoading(true);

    // Simular delay
    setTimeout(() => {
      let results = [...allProducts];

      // Filtro por estado
      if (newFilters.status === 'enabled') {
        results = results.filter(p => p.isEnabled);
      } else if (newFilters.status === 'disabled') {
        results = results.filter(p => !p.isEnabled);
      }

      // Filtro por motivo
      if (newFilters.reason) {
        results = results.filter(p => p.disabledReason === newFilters.reason);
      }

      // Filtro por rango de fecha
      if (newFilters.dateFrom) {
        const dateFrom = new Date(newFilters.dateFrom);
        results = results.filter(p => {
          if (!p.disabledAt) return false;
          return new Date(p.disabledAt) >= dateFrom;
        });
      }

      if (newFilters.dateTo) {
        const dateTo = new Date(newFilters.dateTo);
        results = results.filter(p => {
          if (!p.disabledAt) return false;
          return new Date(p.disabledAt) <= dateTo;
        });
      }

      // Filtro por stock
      if (newFilters.stock === 'with') {
        results = results.filter(p => p.stock && p.stock.some(s => s.quantity > 0));
      } else if (newFilters.stock === 'without') {
        results = results.filter(p => !p.stock || p.stock.every(s => s.quantity === 0));
      } else if (newFilters.stock === 'negative') {
        results = results.filter(p => p.stock && p.stock.some(s => s.quantity < 0));
      }

      // Búsqueda por nombre/código
      if (newFilters.searchTerm) {
        const term = newFilters.searchTerm.toLowerCase();
        results = results.filter(p =>
          p.name.toLowerCase().includes(term) ||
          p.code?.toLowerCase().includes(term) ||
          p.idProduct.toString().includes(term)
        );
      }

      setFilteredProducts(results);
      setLoading(false);
    }, 300);
  }, [allProducts]);

  /**
   * Limpia filtros y restaura lista completa
   */
  const clearFilters = useCallback(() => {
    setFilters({ status: 'enabled' });
    setFilteredProducts(allProducts);
  }, [allProducts]);

  /**
   * Recuenta productos
   */
  const counts = {
    total: allProducts.length,
    enabled: allProducts.filter(p => p.isEnabled).length,
    disabled: allProducts.filter(p => !p.isEnabled).length,
    merged: allProducts.filter(p => p.mergedIntoProductId).length,
    filtered: filteredProducts.length,
  };

  return {
    products: filteredProducts,
    allProducts,
    filters,
    loading,
    counts,
    applyFilters,
    clearFilters,
  };
}

/**
 * Hook: useProductHistory
 * 
 * Propósito:
 * - Cargar y cachear historial de productos
 */
export function useProductHistory(productId: number) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Aquí iría la llamada real a getProductHistory
      // const result = await getProductHistory(productId);
      // setData(result.data);
    } catch (e) {
      setError('Error cargando historial');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  return {
    data,
    loading,
    error,
    loadHistory,
  };
}

/**
 * Hook: useDuplicateDetection
 * 
 * Propósito:
 * - Gestionar detección y confirmación de duplicados
 */
export function useDuplicateDetection() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDetection = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Aquí iría la llamada real a runFullDuplicateDetection
      // const results = await runFullDuplicateDetection();
      // setCandidates([...results.exactCode, ...results.exactName, ...results.fuzzyName, ...results.barcode]);
    } catch (e) {
      setError('Error ejecutando detección');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const pending = candidates.filter(c => c.status === 'PENDING' || !c.status);
  const confirmed = candidates.filter(c => c.status === 'CONFIRMED');

  return {
    candidates,
    pending,
    confirmed,
    loading,
    error,
    runDetection,
    setCandidates,
  };
}
