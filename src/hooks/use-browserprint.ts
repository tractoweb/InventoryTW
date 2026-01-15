"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDefaultPrinter,
  isHttps,
  listLocalPrinters,
  loadBrowserPrintSdk,
  type BrowserPrintNotReadyError,
} from "@/lib/browserprint-client";

export type BrowserPrintStatus = "idle" | "loading" | "ready" | "error";

export function useBrowserPrint() {
  const [status, setStatus] = useState<BrowserPrintStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [printers, setPrinters] = useState<BrowserPrintDevice[]>([]);
  const [selectedPrinterKey, setSelectedPrinterKey] = useState<string>("");

  const httpsWarning = useMemo(() => {
    if (!isHttps()) return null;
    const port = process.env.NEXT_PUBLIC_BROWSERPRINT_PORT ?? "9101";
    return `Estás en HTTPS. BrowserPrint usa http://localhost:${port} y el navegador puede bloquearlo. Si no lista impresoras o no imprime, habilita 'Insecure content' para este sitio en el PC de impresión.`;
  }, []);

  const refreshPrinters = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      await loadBrowserPrintSdk();

      const local = await listLocalPrinters();
      setPrinters(local);

      // Pick a stable key: prefer uid, fall back to name.
      const defaultDevice = await getDefaultPrinter().catch(() => null);
      const defaultKey = defaultDevice ? (defaultDevice.uid ?? defaultDevice.name) : "";
      const firstKey = local[0] ? (local[0].uid ?? local[0].name) : "";

      setSelectedPrinterKey((prev) => prev || defaultKey || firstKey);

      if (local.length === 0 && !defaultDevice) {
        setStatus("error");
        setError("BrowserPrint está disponible, pero no se detectaron impresoras. Revisa drivers/cola de la Zebra.");
        return;
      }

      setStatus("ready");
    } catch (e: unknown) {
      setPrinters([]);
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refreshPrinters();
  }, [refreshPrinters]);

  const selectedPrinter = useMemo(() => {
    if (!selectedPrinterKey) return null;
    return (
      printers.find((p) => (p.uid ?? p.name) === selectedPrinterKey) ??
      null
    );
  }, [printers, selectedPrinterKey]);

  return {
    status,
    error,
    printers,
    selectedPrinterKey,
    setSelectedPrinterKey,
    selectedPrinter,
    httpsWarning,
    refreshPrinters,
  };
}
