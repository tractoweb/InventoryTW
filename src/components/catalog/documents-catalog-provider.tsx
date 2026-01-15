"use client";

import * as React from "react";

import { listDocumentsForBrowserAll, type DocumentsCatalogRow } from "@/actions/list-documents-for-browser-all";

type DocumentsCatalogState = {
  status: "idle" | "loading" | "ready" | "error";
  documents: DocumentsCatalogRow[];
  error: string | null;
  loadedAt: number | null;
};

type DocumentsCatalogApi = DocumentsCatalogState & {
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
};

const DocumentsCatalogContext = React.createContext<DocumentsCatalogApi | null>(null);

const STORAGE_KEY = "itw_documents_catalog_v1";

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function DocumentsCatalogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DocumentsCatalogState>({
    status: "idle",
    documents: [],
    error: null,
    loadedAt: null,
  });

  React.useEffect(() => {
    const cached = safeParseJson<{ documents: DocumentsCatalogRow[]; loadedAt: number }>(
      typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null
    );
    if (cached?.documents?.length) {
      setState({ status: "ready", documents: cached.documents, error: null, loadedAt: cached.loadedAt ?? Date.now() });
    }
  }, []);

  const fetchAll = React.useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    const res = await listDocumentsForBrowserAll();

    if (res.error) {
      setState((s) => ({ ...s, status: "error", error: res.error ?? "No se pudieron cargar documentos" }));
      return;
    }

    const documents = res.data ?? [];
    const loadedAt = Date.now();
    setState({ status: "ready", documents, error: null, loadedAt });

    try {
      const payload = JSON.stringify({ documents, loadedAt });
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
    if (state.status === "ready" && state.documents.length) return;
    if (state.status === "loading") return;
    await fetchAll();
  }, [state.status, state.documents.length, fetchAll]);

  const refresh = React.useCallback(async () => {
    await fetchAll();
  }, [fetchAll]);

  const clear = React.useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setState({ status: "idle", documents: [], error: null, loadedAt: null });
  }, []);

  const value: DocumentsCatalogApi = React.useMemo(
    () => ({
      ...state,
      ensureLoaded,
      refresh,
      clear,
    }),
    [state, ensureLoaded, refresh, clear]
  );

  return <DocumentsCatalogContext.Provider value={value}>{children}</DocumentsCatalogContext.Provider>;
}

export function useDocumentsCatalog(): DocumentsCatalogApi {
  const ctx = React.useContext(DocumentsCatalogContext);
  if (!ctx) throw new Error("useDocumentsCatalog must be used within DocumentsCatalogProvider");
  return ctx;
}
