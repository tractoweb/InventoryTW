"use client";

import * as React from "react";

import { listProductsForMasterAll } from "@/actions/list-products-for-master-all";
import type { ProductsMasterRow } from "@/actions/list-products-for-master";

type ProductsCatalogState = {
  status: "idle" | "loading" | "ready" | "error";
  products: ProductsMasterRow[];
  error: string | null;
  loadedAt: number | null;
};

type ProductsCatalogApi = ProductsCatalogState & {
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
};

const ProductsCatalogContext = React.createContext<ProductsCatalogApi | null>(null);

const STORAGE_KEY = "itw_products_catalog_v1";

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function ProductsCatalogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ProductsCatalogState>({
    status: "idle",
    products: [],
    error: null,
    loadedAt: null,
  });

  // Hydrate from sessionStorage (best-effort). If catalog is huge, it may not have been persisted.
  React.useEffect(() => {
    const cached = safeParseJson<{ products: ProductsMasterRow[]; loadedAt: number }>(
      typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null
    );
    if (cached?.products?.length) {
      setState({ status: "ready", products: cached.products, error: null, loadedAt: cached.loadedAt ?? Date.now() });
    }
  }, []);

  const fetchAll = React.useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    const res = await listProductsForMasterAll();

    if (res.error) {
      setState((s) => ({ ...s, status: "error", error: res.error ?? "No se pudieron cargar productos" }));
      return;
    }

    const products = res.data ?? [];
    const loadedAt = Date.now();
    setState({ status: "ready", products, error: null, loadedAt });

    // Persist only if it’s not too large (avoid exceeding browser storage limits).
    try {
      const payload = JSON.stringify({ products, loadedAt });
      if (payload.length <= 2_000_000) {
        window.sessionStorage.setItem(STORAGE_KEY, payload);
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  const ensureLoaded = React.useCallback(async () => {
    // Avoid refetching if already loaded
    if (state.status === "ready" && state.products.length) return;
    if (state.status === "loading") return;
    await fetchAll();
  }, [state.status, state.products.length, fetchAll]);

  const refresh = React.useCallback(async () => {
    await fetchAll();
  }, [fetchAll]);

  const clear = React.useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setState({ status: "idle", products: [], error: null, loadedAt: null });
  }, []);

  const value: ProductsCatalogApi = React.useMemo(
    () => ({
      ...state,
      ensureLoaded,
      refresh,
      clear,
    }),
    [state, ensureLoaded, refresh, clear]
  );

  return <ProductsCatalogContext.Provider value={value}>{children}</ProductsCatalogContext.Provider>;
}

export function useProductsCatalog(): ProductsCatalogApi {
  const ctx = React.useContext(ProductsCatalogContext);
  if (!ctx) {
    throw new Error("useProductsCatalog must be used within ProductsCatalogProvider");
  }
  return ctx;
}
