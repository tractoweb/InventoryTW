"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listProductsForPrintLabels, type PrintLabelsProductRow } from "@/actions/list-products-for-print-labels";
import { getBarcodesForProducts } from "@/actions/get-barcodes-for-products";
import { useBrowserPrint } from "@/hooks/use-browserprint";
import { useDebounce } from "@/hooks/use-debounce";
import { generate3UpLabelsRow } from "@/utils/zplGenerator";
import type { LabelData } from "@/types/label.types";
import { sendZplWithRetry } from "@/lib/browserprint-client";
import { BarcodeSvg } from "@/components/print-labels/barcode-svg";
import { CameraScannerDialog } from "@/components/print-labels/camera-scanner-dialog";

export default function ProductsBrowser() {
  const pageSize = 50;

  const bp = useBrowserPrint();

  const [rows, setRows] = useState<PrintLabelsProductRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageTokens, setPageTokens] = useState<Record<number, string | null>>({ 1: null });
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [logoSrc, setLogoSrc] = useState<string>("/labels/logo.svg");
  type LogoMode = "off" | "z64" | "compat";
  const [logoMode, setLogoMode] = useState<LogoMode>("off");
  const logoZplByModeRef = useRef<Record<Exclude<LogoMode, "off">, string | null>>({
    z64: null,
    compat: null,
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<LabelData[][]>([]);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const [previewRowWidthPx, setPreviewRowWidthPx] = useState<number>(780);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const isSearching = debouncedQuery.trim().length > 0;

  const [scanOpen, setScanOpen] = useState(false);

  const [selected, setSelected] = useState<Record<number, number>>({});
  const [hoveredProductId, setHoveredProductId] = useState<number | null>(null);

  useEffect(() => {
    // BrowserPrint SDK is loaded/managed by useBrowserPrint()
  }, []);

  useEffect(() => {
    // Try svg first, then png.
    const img = new Image();
    img.onload = () => setLogoSrc("/labels/logo.svg");
    img.onerror = () => setLogoSrc("/labels/logo.png");
    img.src = "/labels/logo.svg";
  }, []);

  // In search mode we still use nextToken (it's a JSON bundle encoded by the action)
  // so pagination works for searches too.
  const currentToken = pageTokens[page] ?? null;

  useEffect(() => {
    // Reset pagination when search changes
    setPage(1);
    setPageTokens({ 1: null });
    setSelected({});
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setMessage(null);

      const res = await listProductsForPrintLabels({
        q: debouncedQuery,
        pageSize,
        nextToken: currentToken,
      });

      if (cancelled) return;

      if (res.error) {
        setRows([]);
        setHasNext(false);
        setMessage(res.error);
        setLoading(false);
        return;
      }

      setRows(res.data ?? []);
      setSelected({});

      const nextToken = res.nextToken ?? null;
      setHasNext(Boolean(nextToken));
      setPageTokens((prev) => ({ ...prev, [page + 1]: nextToken }));
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [page, currentToken, debouncedQuery, isSearching]);

  useEffect(() => {
    let cancelled = false;
    async function loadBarcodes() {
      if (!rows.length) return;

      const idsToLoad = rows.filter((r) => r.barcodes === null).map((r) => r.idProduct);
      if (idsToLoad.length === 0) return;

      const res = await getBarcodesForProducts(idsToLoad);
      if (cancelled) return;

      if (res.error) {
        // Keep table usable even if barcodes fail to load.
        setRows((prev) => prev.map((r) => (r.barcodes === null ? { ...r, barcodes: [] } : r)));
        return;
      }

      setRows((prev) =>
        prev.map((r) => {
          if (r.barcodes !== null) return r;
          const barcodes = res.data?.[r.idProduct] ?? [];
          return { ...r, barcodes };
        })
      );
    }

    loadBarcodes();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const handleSelect = (idProduct: number, checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[idProduct] = 1;
      else delete next[idProduct];
      return next;
    });
  };

  const handleQtyChange = (idProduct: number, qty: number) => {
    setSelected((prev) => ({ ...prev, [idProduct]: qty }));
  };

  const selectedCount = useMemo(() => Object.keys(selected).length, [selected]);
  const hoveredRow = useMemo(
    () => (hoveredProductId ? rows.find((r) => r.idProduct === hoveredProductId) ?? null : null),
    [hoveredProductId, rows]
  );

  const formatName = (name: string) => {
    if (name.length <= 20) return [name];
    const words = name.split(" ");
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      if ((line + " " + word).trim().length > 20) {
        lines.push(line.trim());
        line = word;
      } else {
        line += " " + word;
      }
    }
    if (line) lines.push(line.trim());
    return lines;
  };

  const toIsoDate = (value: string | null) => {
    if (!value) return "";
    return String(value).split("T")[0];
  };

  const renderStickerPreview = (label: LabelData, options?: { widthPx?: number }) => {
    // Preview tries to mirror the ZPL layout (see generate3UpLabelsRow in src/utils/zplGenerator.ts)
    // using the same physical measurements and DPI.
    const dpi = Number(process.env.NEXT_PUBLIC_ZEBRA_DPI ?? 203);
    const safeDpi = Number.isFinite(dpi) ? Math.max(100, Math.trunc(dpi)) : 203;
    const cmToDots = (cm: number) => Math.round((cm * safeDpi) / 2.54);

    const labelW = cmToDots(3.2);
    const labelH = cmToDots(2.5);
    const outerX = cmToDots(0.2);
    const marginTop = cmToDots(0.1);
    const marginBottom = cmToDots(0.1);

    // Matches the ZPL generator tweak (lower name slightly to compensate upward drift)
    const nameY = marginTop + cmToDots(0.23);
    const posY = cmToDots(1.15);
    const dateY = posY + cmToDots(0.25);

    const barcodeH = 40; // dots (as in ^BCN,40...)
    const barcodeTextH = 18; // dots
    const barcodeGap = cmToDots(0.1);
    const bottomPad = marginBottom + cmToDots(0.1);
    const barcodeY = Math.max(dateY + cmToDots(0.1), labelH - bottomPad - (barcodeH + barcodeGap + barcodeTextH));
    const barcodeTextY = barcodeY + barcodeH + barcodeGap;

    const pxW = options?.widthPx ?? 200;
    const scale = pxW / labelW;
    const pxH = Math.round(labelH * scale);

    const name = String(label.nombreProducto ?? "");
    const lote = String(label.lote ?? "");
    const fecha = String(label.fecha ?? "");
    const barcode = String(label.codigoBarras ?? "");
    const radius = Math.max(2, Math.round(8 * scale)); // ~0.1cm

    const nameLinesAll = formatName(name);
    const nameLines = nameLinesAll.slice(0, 3);
    if (nameLinesAll.length > 3 && nameLines.length) {
      nameLines[nameLines.length - 1] = `${nameLines[nameLines.length - 1]}…`;
    }

    const nameFont =
      name.length > 45
        ? Math.max(8, Math.round(10 * scale))
        : name.length > 30
          ? Math.max(9, Math.round(11 * scale))
          : Math.max(10, Math.round(12 * scale));

    const showLogo = logoMode !== "off";

    return (
      <div
        className="border bg-white"
        style={{
          width: pxW,
          height: pxH,
          position: "relative",
          overflow: "hidden",
          borderRadius: radius,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        {showLogo ? (
          <img
            src={logoSrc}
            alt="Logo"
            style={{
              position: "absolute",
              // Align with the default logo snippet (^FO32,0 ...)
              left: Math.round(32 * scale),
              top: 0,
              width: Math.round(90 * scale),
              height: Math.round(40 * scale),
              objectFit: "contain",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            left: Math.round((32 + outerX) * scale),
            top: Math.round(nameY * scale),
            fontSize: nameFont,
            fontWeight: 600,
            lineHeight: 1.0,
            width: pxW - Math.round(32 * scale),
            maxHeight: Math.round(54 * scale),
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
          title={name}
        >
          {(nameLines.length ? nameLines : [name]).map((line, i) => (
            <div key={i} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {line}
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            left: Math.round((32 + outerX) * scale),
            top: Math.round(posY * scale),
            fontSize: Math.max(8, Math.round(10 * scale)),
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
            width: pxW - Math.round(32 * scale),
          }}
          title={lote}
        >
          {lote}
        </div>

        <div
          style={{
            position: "absolute",
            left: Math.round((32 + outerX) * scale),
            top: Math.round(dateY * scale),
            fontSize: Math.max(8, Math.round(10 * scale)),
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
            width: pxW - Math.round(32 * scale),
          }}
          title={fecha}
        >
          {fecha}
        </div>

        <div
          style={{
            position: "absolute",
            left: Math.round((32 + outerX - 4) * scale),
            top: Math.round(barcodeY * scale),
            width: pxW - Math.round(24 * scale),
            height: Math.max(0, pxH - Math.round(barcodeY * scale)),
            display: "flex",
            flexDirection: "column",
            gap: Math.max(2, Math.round(4 * scale)),
          }}
          title={barcode}
        >
          <BarcodeSvg value={barcode} height={Math.max(18, Math.round(barcodeH * scale))} barWidth={1} className="w-full" />
          <div
            style={{
              fontSize: Math.max(7, Math.round(9 * scale)),
              lineHeight: 1.1,
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
            }}
            title={barcode}
          >
            {barcode}
          </div>
        </div>
      </div>
    );
  };

  const render3UpRowPreview = (rowLabels: LabelData[], options?: { totalWidthPx?: number }) => {
    const dpi = Number(process.env.NEXT_PUBLIC_ZEBRA_DPI ?? 203);
    const safeDpi = Number.isFinite(dpi) ? Math.max(100, Math.trunc(dpi)) : 203;
    const cmToDots = (cm: number) => Math.round((cm * safeDpi) / 2.54);

    // Matches generate3UpLabelsRow (roll size in ZebraDesigner: 10.40cm x 2.70cm)
    const labelW = cmToDots(3.2);
    const labelH = cmToDots(2.5);
    const outerX = cmToDots(0.2);
    const gapX = cmToDots(0.2);
    const gapY = cmToDots(0.2);

    const totalW = outerX + labelW + gapX + labelW + gapX + labelW + outerX;
    const pitchH = labelH + gapY;

    const pxTotalW = options?.totalWidthPx ?? 780;
    const scale = pxTotalW / totalW;
    const pxLabelW = Math.round(labelW * scale);
    const pxLabelH = Math.round(labelH * scale);
    const pxRowH = Math.round(pitchH * scale);
    const pxPadX = Math.round(outerX * scale);
    const pxGapX = Math.round(gapX * scale);
    const pxGapY = Math.max(1, Math.round(gapY * scale));

    const slots = rowLabels.slice(0, 3);

    return (
      <div
        className="rounded"
        style={{
          width: pxTotalW,
          height: pxRowH,
          paddingLeft: pxPadX,
          paddingRight: pxPadX,
          display: "flex",
          gap: pxGapX,
          alignItems: "flex-start",
          overflow: "hidden",
          position: "relative",
          background: "rgba(0,0,0,0.02)",
        }}
      >
        {/* Roll boundary */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            border: "1px solid rgba(0,0,0,0.18)",
            borderRadius: 6,
            pointerEvents: "none",
          }}
        />

        {/* Cut/advance line: end of label (2.5cm) + gap area (0.2cm) */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: pxLabelH,
            height: 0,
            borderTop: "1px dashed rgba(0,0,0,0.22)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: pxLabelH,
            height: pxGapY,
            background: "rgba(255, 193, 7, 0.08)",
            pointerEvents: "none",
          }}
        />

        {/* Label area guides (3 columns) */}
        {Array.from({ length: 3 }).map((_, i) => {
          const left = pxPadX + i * (pxLabelW + pxGapX);
          return (
            <div
              key={i}
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left,
                width: pxLabelW,
                height: pxLabelH,
                border: "1px dashed rgba(0,0,0,0.18)",
                borderRadius: 6,
                pointerEvents: "none",
              }}
            />
          );
        })}

        {slots.map((lbl, j) => (
          <div key={j} style={{ width: pxLabelW, flex: "0 0 auto" }}>
            {renderStickerPreview(lbl, { widthPx: pxLabelW })}
          </div>
        ))}
      </div>
    );
  };

  const renderZplLikePreview = (row: PrintLabelsProductRow) => {
    const primaryBarcode = row.barcodes && row.barcodes.length ? row.barcodes[0] : row.reference ?? String(row.idProduct);
    const label: LabelData = {
      nombreProducto: String(row.name ?? ""),
      codigoBarras: String(primaryBarcode ?? ""),
      lote: String(row.measurementUnit ?? ""),
      fecha: toIsoDate(row.createdAt),
    };
    return renderStickerPreview(label, { widthPx: 160 });
  };

  const buildLabelFromRow = (row: PrintLabelsProductRow, barcodesOverlay?: Record<number, string[]>): LabelData => {
    const effectiveBarcodes =
      row.barcodes === null ? (barcodesOverlay?.[row.idProduct] ?? []) : (row.barcodes ?? []);
    const primaryBarcode = effectiveBarcodes[0] ?? row.reference ?? String(row.idProduct);
    return {
      nombreProducto: row.name,
      codigoBarras: String(primaryBarcode),
      lote: row.measurementUnit ?? "",
      fecha: toIsoDate(row.createdAt),
    };
  };

  const buildPrintPlanRows = (
    selectedIds: number[],
    barcodesOverlay: Record<number, string[]>
  ): LabelData[][] => {
    // Qty means: number of ROWS to print for that product.
    // Each row has 3 stickers (same product) and prints left-to-right.
    const plan: LabelData[][] = [];
    for (const idProduct of selectedIds) {
      const row = rows.find((r) => r.idProduct === idProduct);
      if (!row) continue;
      const qtyRows = selected[idProduct] ?? 1;
      const label = buildLabelFromRow(row, barcodesOverlay);
      for (let i = 0; i < qtyRows; i++) {
        plan.push([label, label, label]);
      }
    }
    return plan;
  };

  const preparePrintPreview = async () => {
    if (printing) return;
    setMessage(null);
    setPreviewLoading(true);

    const selectedIds = rows.filter((r) => selected[r.idProduct]).map((r) => r.idProduct);
    if (selectedIds.length === 0) {
      setPreviewLoading(false);
      return;
    }

    const barcodesOverlay: Record<number, string[]> = {};

    try {
      // Load logo snippet only if enabled.
      // NOTE: Zebra GC420t (USB) often fails with :Z64: (prints “error01”), so default is OFF.
      if (logoMode !== "off") {
        const modeKey = logoMode;
        if (logoZplByModeRef.current[modeKey] === null) {
          const url = modeKey === "compat" ? "/labels/logo-compat.zpl" : "/labels/logo.zpl";
          try {
            const res = await fetch(url, { cache: "no-store" });
            logoZplByModeRef.current[modeKey] = res.ok ? await res.text() : "";
          } catch {
            logoZplByModeRef.current[modeKey] = "";
          }
        }
      }

      // Ensure barcodes for selected items
      const missing = rows.filter((r) => selected[r.idProduct] && r.barcodes === null).map((r) => r.idProduct);
      if (missing.length > 0) {
        const res = await getBarcodesForProducts(missing);
        if (res.error) throw new Error(res.error);
        Object.assign(barcodesOverlay, res.data ?? {});
        setRows((prev) =>
          prev.map((r) => {
            if (!selectedIds.includes(r.idProduct)) return r;
            if (r.barcodes !== null) return r;
            return { ...r, barcodes: res.data?.[r.idProduct] ?? [] };
          })
        );
      }

      const plan = buildPrintPlanRows(selectedIds, barcodesOverlay);
      setPreviewRows(plan);
      setPreviewOpen(true);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!previewOpen) return;
    const el = previewViewportRef.current;
    if (!el) return;

    const compute = () => {
      // Keep some room for borders/padding/scrollbars.
      const w = el.clientWidth;
      const safe = Number.isFinite(w) ? Math.max(360, Math.floor(w) - 8) : 780;
      setPreviewRowWidthPx(safe);
    };

    compute();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewOpen]);

  const confirmAndPrint = async () => {
    if (printing) return;

    if (bp.status !== "ready" || !bp.selectedPrinter) {
      setMessage("BrowserPrint no está listo o no hay impresora seleccionada. Usa 'Refrescar impresoras'.");
      return;
    }

    const printer = bp.selectedPrinter;

    const plan = previewRows;
    if (!plan.length) return;

    setPreviewOpen(false);
    setPrinting(true);
    setMessage(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    let idx = 0;
    let errors = 0;
    let printedWithoutLogo = false;

    const getLogoZpl = () => {
      if (logoMode === "off") return "";
      const v = logoZplByModeRef.current[logoMode] ?? "";
      return String(v);
    };

    const run = async () => {
      while (idx < plan.length) {
        if (abortRef.current?.signal.aborted) {
          setPrinting(false);
          setMessage("Impresión detenida.");
          return;
        }

        const rowLabels = plan[idx++];
        const buildZpl = (opts?: { disableLogo?: boolean }) =>
          generate3UpLabelsRow(rowLabels, {
            includeDefaultsHeader: true,
            logoZpl: opts?.disableLogo ? "" : getLogoZpl(),
            dpi: Number(process.env.NEXT_PUBLIC_ZEBRA_DPI ?? 203),
            includeBorder: false,
          });

        const zpl = buildZpl();

        try {
          await sendZplWithRetry(printer, zpl, {
            timeoutMs: 6000,
            retries: 2,
            retryDelayMs: 250,
            signal: abortRef.current?.signal,
          });
        } catch (e: unknown) {
          if (abortRef.current?.signal.aborted) {
            setPrinting(false);
            setMessage("Impresión detenida.");
            return;
          }

          // Retry once without logo to isolate common incompatibilities.
          const hadLogo = logoMode !== "off" && Boolean(getLogoZpl().trim());
          if (hadLogo) {
            try {
              printedWithoutLogo = true;
              const zplNoLogo = buildZpl({ disableLogo: true });
              await sendZplWithRetry(printer, zplNoLogo, {
                timeoutMs: 6000,
                retries: 1,
                retryDelayMs: 250,
                signal: abortRef.current?.signal,
              });
              // continue to next row
              continue;
            } catch {
              // fallthrough to stop with error
            }
          }

          errors++;
          const msg = e instanceof Error ? e.message : String(e);
          setPrinting(false);
          setMessage(`Error al imprimir (fila ${idx}): ${msg}`);
          return;
        }
      }

      setPrinting(false);
      if (errors === 0) {
        setMessage(
          printedWithoutLogo
            ? "¡Etiquetas enviadas correctamente! (Se imprimió sin logo por compatibilidad)"
            : "¡Etiquetas enviadas correctamente!"
        );
      } else {
        setMessage(`Algunas filas fallaron (${errors})`);
      }
    };

    await run();
  };

  // Printing is confirmed from the preview dialog.

  const handleStopPrinting = () => {
    if (!printing) return;
    abortRef.current?.abort();
    setMessage("Deteniendo impresión...");
  };

  const handleTestPrint = async () => {
    setMessage(null);

    if (bp.status !== "ready" || !bp.selectedPrinter) {
      setMessage("BrowserPrint no está listo o no hay impresora seleccionada.");
      return;
    }

    const printer = bp.selectedPrinter;

    try {
      setPrinting(true);
      const testZpl = "^XA^CI28^FO30,30^A0N,35,35^FDTEST BROWSERPRINT^FS^XZ";
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      await sendZplWithRetry(printer, testZpl, {
        timeoutMs: 6000,
        retries: 2,
        retryDelayMs: 250,
        signal: abortRef.current.signal,
      });
      setMessage("Etiqueta de prueba enviada.");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? `Error al imprimir prueba: ${e.message}` : `Error al imprimir prueba: ${String(e)}`);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Impresión de Etiquetas Zebra</h1>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page === 1 || printing}>
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {isSearching ? `Página ${page} (búsqueda)` : `Página ${page}`}
            </div>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={loading || !hasNext || printing}>
              Siguiente
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="destructive" onClick={handleStopPrinting} disabled={!printing}>
              Detener impresión
            </Button>
            <Button onClick={preparePrintPreview} disabled={printing || selectedCount === 0 || previewLoading}>
              {previewLoading ? "Preparando preview..." : "Imprimir (ver preview)"}
            </Button>
          </div>
        </div>
      </div>

      {bp.httpsWarning ? (
        <div className="mb-4 rounded-md border p-3 text-sm">
          <div className="font-medium mb-1">Nota (HTTPS)</div>
          <div className="text-muted-foreground">{bp.httpsWarning}</div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-4">
        <div className="space-y-1">
          <div className="text-sm font-medium">Impresora (BrowserPrint)</div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border px-2 text-sm min-w-[320px]"
              value={bp.selectedPrinterKey}
              onChange={(e) => bp.setSelectedPrinterKey(e.target.value)}
              disabled={bp.status === "loading" || printing}
            >
              {bp.printers.length === 0 ? (
                <option value="">No hay impresoras detectadas</option>
              ) : (
                bp.printers.map((p) => {
                  const key = (p.uid ?? p.name) as string;
                  return (
                    <option key={key} value={key}>
                      {p.name}
                    </option>
                  );
                })
              )}
            </select>
            <Button variant="outline" onClick={bp.refreshPrinters} disabled={bp.status === "loading" || printing}>
              Refrescar
            </Button>
            <Button variant="outline" onClick={handleTestPrint} disabled={bp.status !== "ready" || printing || !bp.selectedPrinter}>
              Probar impresión
            </Button>
          </div>
          {bp.error ? <div className="text-xs text-red-600">{bp.error}</div> : null}
        </div>

        <div className="flex items-center gap-3">
          <Input
            placeholder="Buscar por nombre, referencia o código de barras"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md"
          />
          <Button variant="outline" onClick={() => setScanOpen(true)} disabled={printing || previewLoading}>
            Escanear
          </Button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <label htmlFor="print-labels-logo-mode" className="select-none whitespace-nowrap">
          Logo (ZPL)
        </label>
        <select
          id="print-labels-logo-mode"
          className="h-9 rounded-md border px-2 text-sm"
          value={logoMode}
          onChange={(e) => setLogoMode(e.target.value as LogoMode)}
          disabled={printing || previewLoading}
        >
          <option value="off">OFF (recomendado)</option>
          <option value="compat">COMPAT (GC420t)</option>
          <option value="z64">Z64 (puede fallar)</option>
        </select>
        <div className="text-muted-foreground">
          GC420t USB: usa <span className="font-medium">COMPAT</span> o <span className="font-medium">OFF</span> si sale “error01”.
        </div>
      </div>

      {isSearching ? <div className="mb-4 text-sm text-muted-foreground">Mostrando resultados de búsqueda</div> : null}

      {loading ? (
        <div>Cargando productos...</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="overflow-x-hidden overflow-y-auto border rounded">
            <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "44px" }} />
              <col style={{ width: "80px" }} />
              <col style={{ width: "1fr" }} />
              <col style={{ width: "180px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "90px" }} />
            </colgroup>
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 w-10"></th>
                <th className="p-2 text-left whitespace-nowrap">ID</th>
                <th className="p-2 text-left whitespace-nowrap">Nombre</th>
                <th className="p-2 text-left whitespace-nowrap">Referencia</th>
                <th className="p-2 text-left whitespace-nowrap">Posición</th>
                <th className="p-2 text-left whitespace-nowrap">Fecha creación</th>
                <th className="p-2 text-left whitespace-nowrap">Filas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const checked = Boolean(selected[r.idProduct]);
                const qty = selected[r.idProduct] ?? 1;

                return (
                  <tr
                    key={r.idProduct}
                    className="border-t"
                    onMouseEnter={() => setHoveredProductId(r.idProduct)}
                  >
                    <td className="p-2 align-top">
                      <Checkbox checked={checked} onCheckedChange={(v) => handleSelect(r.idProduct, Boolean(v))} />
                    </td>
                    <td className="p-2 align-top whitespace-nowrap">{r.idProduct}</td>
                    <td className="p-2 align-top truncate" title={r.name}>{r.name}</td>
                    <td className="p-2 align-top truncate" title={r.reference ?? ""}>{r.reference ?? ""}</td>
                    <td className="p-2 align-top truncate" title={r.measurementUnit ?? ""}>{r.measurementUnit ?? ""}</td>
                    <td className="p-2 align-top whitespace-nowrap">{toIsoDate(r.createdAt)}</td>
                    <td className="p-2 align-top">
                      {checked ? (
                        <Input
                          type="number"
                          min={1}
                          value={qty}
                          onChange={(e) => handleQtyChange(r.idProduct, Math.max(1, Number(e.target.value)))}
                          className="w-20"
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <div className="hidden xl:block">
            <div className="sticky top-4 rounded border bg-muted/10 p-3">
              <div className="text-sm font-medium mb-2">Vista previa (hover)</div>
              {!hoveredRow ? (
                <div className="text-sm text-muted-foreground">
                  Pasa el mouse por una fila para ver el código de barras y el preview de la etiqueta.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold truncate" title={hoveredRow.name}>
                      {hoveredRow.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={hoveredRow.reference ?? ""}>
                      Ref: {hoveredRow.reference ?? "—"}
                    </div>
                  </div>

                  <div className="bg-white border rounded p-2">
                    {hoveredRow.barcodes === null ? (
                      <div className="text-sm text-muted-foreground">Cargando códigos…</div>
                    ) : hoveredRow.barcodes && hoveredRow.barcodes.length ? (
                      <div className="space-y-1">
                        <BarcodeSvg value={hoveredRow.barcodes[0]} height={48} barWidth={1} className="w-full" />
                        <div className="text-xs text-center text-muted-foreground truncate" title={hoveredRow.barcodes[0]}>
                          {hoveredRow.barcodes[0]}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Sin código de barras</div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Preview etiqueta</div>
                    <div className="overflow-hidden">
                      {(() => {
                        const primaryBarcode =
                          hoveredRow.barcodes && hoveredRow.barcodes.length
                            ? hoveredRow.barcodes[0]
                            : (hoveredRow.reference ?? String(hoveredRow.idProduct));

                        const label: LabelData = {
                          nombreProducto: String(hoveredRow.name ?? ""),
                          codigoBarras: String(primaryBarcode ?? ""),
                          lote: String(hoveredRow.measurementUnit ?? ""),
                          fecha: toIsoDate(hoveredRow.createdAt),
                        };

                        return renderStickerPreview(label, { widthPx: 240 });
                      })()}
                    </div>
                  </div>

                  {hoveredRow.barcodes && hoveredRow.barcodes.length > 1 ? (
                    <div className="text-xs text-muted-foreground">
                      Otros: {hoveredRow.barcodes.slice(1, 6).join(", ")}
                      {hoveredRow.barcodes.length > 6 ? "…" : ""}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 mt-4">
        <div className="text-sm text-muted-foreground">
          Mostrando {rows.length} items (página de {pageSize}). Seleccionados: {selectedCount}. Cada fila imprime 3 etiquetas.
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {printing ? "Imprimiendo…" : ""}
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={(open) => (previewLoading || printing ? null : setPreviewOpen(open))}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Preview de impresión</DialogTitle>
            <DialogDescription>
              Se imprimirán {previewRows.length} filas (total {previewRows.length * 3} etiquetas). Orden: izquierda→derecha, empezando arriba.
            </DialogDescription>
          </DialogHeader>

          <div ref={previewViewportRef} className="max-h-[65vh] overflow-auto border rounded p-3 bg-muted/20">
            {previewRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay nada para imprimir.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {previewRows.map((rowLabels, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-16 text-xs text-muted-foreground pt-2">Fila {i + 1}</div>
                    <div className="overflow-x-auto">
                      {render3UpRowPreview(rowLabels, { totalWidthPx: previewRowWidthPx })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={printing || previewLoading}>
              Cancelar
            </Button>
            <Button onClick={confirmAndPrint} disabled={printing || previewLoading || previewRows.length === 0 || bp.status !== "ready" || !bp.selectedPrinter}>
              Confirmar e imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {message ? <div className="mt-4 text-center font-semibold">{message}</div> : null}

      <CameraScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetected={(value) => {
          setQuery(String(value));
          setMessage(`Escaneado: ${String(value)}`);
        }}
      />
    </div>
  );
}
