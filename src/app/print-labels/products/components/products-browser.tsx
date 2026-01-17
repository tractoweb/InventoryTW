"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { compute3UpStickerLayout } from "@/utils/labelLayout";
import type { LabelData } from "@/types/label.types";
import { sendZplWithRetry } from "@/lib/browserprint-client";
import { BarcodeSvg } from "@/components/print-labels/barcode-svg";
import { CameraScannerDialog } from "@/components/print-labels/camera-scanner-dialog";
import {
  createPrintLabelRequest,
  listPendingPrintLabelRequests,
  setPrintLabelRequestStatus,
  type CreatePrintLabelRequestItemInput,
  type PrintLabelRequestDto,
} from "@/actions/print-label-requests";

export default function ProductsBrowser() {
  const pageSize = 15;

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
  type LabelSlot = LabelData | null;
  const [previewRows, setPreviewRows] = useState<LabelSlot[][]>([]);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const [previewRowWidthPx, setPreviewRowWidthPx] = useState<number>(780);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const isSearching = debouncedQuery.trim().length > 0;

  const [scanOpen, setScanOpen] = useState(false);

  type RequestItemSnapshot = {
    idProduct: number;
    name: string;
    reference: string | null;
    measurementUnit: string | null;
    createdAt: string | null;
    barcodes: string[] | null;
    qty: number;
  };

  type PrintRequest = {
    requestId: string;
    requestedAt: string;
    status: string;
    items: RequestItemSnapshot[];
  };

  const [requestsOpen, setRequestsOpen] = useState(false);
  const [requests, setRequests] = useState<PrintRequest[]>([]);
  const [draftList, setDraftList] = useState<Record<number, RequestItemSnapshot>>({});

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const res = await listPendingPrintLabelRequests();
      if (cancelled) return;
      if (res.error) {
        // Keep UI usable even if persistence fails.
        setMessage(res.error);
        return;
      }

      const mapped: PrintRequest[] = (res.data ?? []).map((r: PrintLabelRequestDto) => ({
        requestId: r.requestId,
        requestedAt: r.requestedAt,
        status: r.status,
        items: (r.items ?? []).map((it) => ({
          idProduct: Number(it.productId),
          name: it.name,
          reference: it.reference ?? null,
          measurementUnit: it.measurementUnit ?? null,
          createdAt: it.productCreatedAt ?? null,
          barcodes: [it.primaryBarcode].filter(Boolean),
          qty: Number(it.qty),
        })),
      }));

      setRequests(mapped);
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selected, setSelected] = useState<Record<number, number>>({});
  const [hoveredProductId, setHoveredProductId] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverMounted, setHoverMounted] = useState(false);
  const hoverPopoverRef = useRef<HTMLDivElement | null>(null);
  const [hoverPopoverSize, setHoverPopoverSize] = useState<{ w: number; h: number }>({ w: 280, h: 220 });

  useEffect(() => {
    // BrowserPrint SDK is loaded/managed by useBrowserPrint()
  }, []);

  useEffect(() => {
    setHoverMounted(true);
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
      if (checked) next[idProduct] = Math.max(1, Number(next[idProduct] ?? 1) || 1);
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

  const hoverEnabled = useMemo(() => !previewOpen && !scanOpen && !printing && !previewLoading, [previewOpen, scanOpen, printing, previewLoading]);

  useLayoutEffect(() => {
    if (!hoverMounted) return;
    if (!hoverEnabled) return;
    if (!hoveredRow) return;
    const el = hoverPopoverRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Number.isFinite(rect.width) ? Math.max(220, Math.round(rect.width)) : 280;
      const h = Number.isFinite(rect.height) ? Math.max(140, Math.round(rect.height)) : 220;
      setHoverPopoverSize({ w, h });
    };

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [hoverMounted, hoverEnabled, hoveredRow]);

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

  const draftSummary = useMemo(() => {
    const items = Object.values(draftList);
    const products = items.length;
    const stickers = items.reduce((sum, it) => sum + Math.max(0, Number(it.qty) || 0), 0);
    return { products, stickers };
  }, [draftList]);

  const requestsSummary = useMemo(() => {
    const count = requests.length;
    const stickers = requests.reduce(
      (sum, r) => sum + r.items.reduce((s2, it) => s2 + Math.max(0, Number(it.qty) || 0), 0),
      0
    );
    return { count, stickers };
  }, [requests]);

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
    const xShift = cmToDots(0.3); // 3mm right shift (matches ZPL)

    const layout = compute3UpStickerLayout(safeDpi, String(label.nombreProducto ?? ""));

    // Positions come from the shared layout (prevents overlaps)
    const nameY = layout.nameY;
    const nameLinesMax = layout.nameLinesMax;
    const posY = layout.posY;
    const dateY = layout.dateY;
    const barcodeH = layout.barcodeH;
    const barcodeY = layout.barcodeY;
    const barcodeTextY = layout.barcodeTextY;

    const pxW = options?.widthPx ?? 200;
    const scale = pxW / labelW;
    const pxH = Math.round(labelH * scale);

    const name = String(label.nombreProducto ?? "");
    const lote = String(label.lote ?? "");
    const fecha = String(label.fecha ?? "");
    const barcode = String(label.codigoBarras ?? "");
    const radius = Math.max(2, Math.round(8 * scale)); // ~0.1cm

    const nameLinesAll = formatName(name);
    const nameLines = nameLinesAll.slice(0, nameLinesMax);
    if (nameLinesAll.length > nameLinesMax && nameLines.length) {
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
              left: Math.round((32 + xShift) * scale),
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
            left: Math.round((32 + outerX + xShift) * scale),
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
            left: Math.round((32 + outerX + xShift) * scale),
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
            left: Math.round((32 + outerX + xShift) * scale),
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
            left: Math.round((32 + outerX - 4 + xShift) * scale),
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

  const render3UpRowPreview = (rowLabels: LabelSlot[], options?: { totalWidthPx?: number }) => {
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
            {lbl ? (
              renderStickerPreview(lbl, { widthPx: pxLabelW })
            ) : (
              <div
                className="border bg-white"
                style={{
                  width: pxLabelW,
                  height: pxLabelH,
                  borderRadius: 6,
                }}
              />
            )}
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

  const mergeSelectedIntoDraft = async () => {
    if (printing || previewLoading) return;

    const selectedIds = rows.filter((r) => selected[r.idProduct]).map((r) => r.idProduct);
    if (selectedIds.length === 0) {
      setMessage("No hay productos seleccionados para agregar.");
      return;
    }

    try {
      setMessage(null);

      // Ensure barcodes for selected items so the list has stable data.
      const missing = rows.filter((r) => selected[r.idProduct] && r.barcodes === null).map((r) => r.idProduct);
      let overlay: Record<number, string[]> = {};
      if (missing.length > 0) {
        const res = await getBarcodesForProducts(missing);
        if (res.error) throw new Error(res.error);
        overlay = res.data ?? {};
        setRows((prev) =>
          prev.map((r) => {
            if (!selectedIds.includes(r.idProduct)) return r;
            if (r.barcodes !== null) return r;
            return { ...r, barcodes: overlay[r.idProduct] ?? [] };
          })
        );
      }

      setDraftList((prev) => {
        const next = { ...prev };
        for (const idProduct of selectedIds) {
          const row = rows.find((r) => r.idProduct === idProduct);
          if (!row) continue;
          const qty = Math.max(1, Number(selected[idProduct] ?? 1) || 1);
          const effectiveBarcodes =
            row.barcodes === null ? (overlay?.[row.idProduct] ?? []) : (row.barcodes ?? []);

          const existing = next[idProduct];
          next[idProduct] = {
            idProduct,
            name: String(row.name ?? ""),
            reference: row.reference ?? null,
            measurementUnit: row.measurementUnit ?? null,
            createdAt: row.createdAt ?? null,
            barcodes: effectiveBarcodes,
            qty: (existing?.qty ?? 0) + qty,
          };
        }
        return next;
      });

      setSelected({});
      setMessage("Agregado a la lista.");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const sendPrintRequest = async () => {
    if (printing || previewLoading) return;

    const selectedIds = rows.filter((r) => selected[r.idProduct]).map((r) => r.idProduct);
    if (selectedIds.length === 0) {
      setMessage("No hay productos seleccionados para enviar solicitud.");
      return;
    }

    try {
      setMessage(null);

      // Ensure barcodes for selected items so the request is stable.
      const missing = rows.filter((r) => selected[r.idProduct] && r.barcodes === null).map((r) => r.idProduct);
      let overlay: Record<number, string[]> = {};
      if (missing.length > 0) {
        const res = await getBarcodesForProducts(missing);
        if (res.error) throw new Error(res.error);
        overlay = res.data ?? {};
        setRows((prev) =>
          prev.map((r) => {
            if (!selectedIds.includes(r.idProduct)) return r;
            if (r.barcodes !== null) return r;
            return { ...r, barcodes: overlay[r.idProduct] ?? [] };
          })
        );
      }

      const map: Record<number, RequestItemSnapshot> = {};
      for (const idProduct of selectedIds) {
        const row = rows.find((r) => r.idProduct === idProduct);
        if (!row) continue;
        const qty = Math.max(1, Number(selected[idProduct] ?? 1) || 1);
        const effectiveBarcodes = row.barcodes === null ? (overlay?.[row.idProduct] ?? []) : (row.barcodes ?? []);

        map[idProduct] = {
          idProduct,
          name: String(row.name ?? ""),
          reference: row.reference ?? null,
          measurementUnit: row.measurementUnit ?? null,
          createdAt: row.createdAt ?? null,
          barcodes: effectiveBarcodes,
          qty,
        };
      }

      const items = Object.values(map).sort((a, b) => a.idProduct - b.idProduct);
      if (items.length === 0) {
        setMessage("No se pudo armar la solicitud con los seleccionados.");
        return;
      }

      const payload: CreatePrintLabelRequestItemInput[] = items.map((it) => ({
        productId: it.idProduct,
        qty: it.qty,
        name: it.name,
        reference: it.reference,
        measurementUnit: it.measurementUnit,
        productCreatedAt: it.createdAt,
        primaryBarcode: (it.barcodes?.[0] ?? it.reference ?? String(it.idProduct)).toString(),
      }));

      const created = await createPrintLabelRequest(payload);
      if (created.error || !created.data) throw new Error(created.error ?? "No se pudo crear la solicitud");

      const req: PrintRequest = {
        requestId: created.data.requestId,
        requestedAt: created.data.requestedAt,
        status: created.data.status,
        items: items,
      };

      setRequests((prev) => [...prev, req]);
      setSelected({});
      setMessage(`Solicitud enviada (${items.length} productos).`);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const ensureLogoSnippet = async () => {
    if (logoMode === "off") return;
    const modeKey = logoMode;
    if (logoZplByModeRef.current[modeKey] !== null) return;
    const url = modeKey === "compat" ? "/labels/logo-compat.zpl" : "/labels/logo.zpl";
    try {
      const res = await fetch(url, { cache: "no-store" });
      logoZplByModeRef.current[modeKey] = res.ok ? await res.text() : "";
    } catch {
      logoZplByModeRef.current[modeKey] = "";
    }
  };

  const printRequestsNow = async () => {
    if (printing) return;

    if (bp.status !== "ready" || !bp.selectedPrinter) {
      setMessage("BrowserPrint no está listo o no hay impresora seleccionada.");
      return;
    }

    if (requests.length === 0) {
      setMessage("No hay solicitudes pendientes.");
      return;
    }

    setRequestsOpen(false);
    setPrinting(true);
    setMessage(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const printer = bp.selectedPrinter;
    const requestsToPrint = [...requests];

    const getLogoZpl = () => {
      if (logoMode === "off") return "";
      const v = logoZplByModeRef.current[logoMode] ?? "";
      return String(v);
    };

    try {
      await ensureLogoSnippet();

      // Print requests in order; mark each as PRINTED on success.
      for (let rIndex = 0; rIndex < requestsToPrint.length; rIndex++) {
        if (abortRef.current.signal.aborted) throw new Error("Impresión detenida.");

        const req = requestsToPrint[rIndex];
        setMessage(`Imprimiendo solicitud ${rIndex + 1}/${requestsToPrint.length}…`);

        // Ensure barcodes if missing
        const missingIds = req.items
          .filter((it) => it.barcodes === null)
          .map((it) => it.idProduct);
        let overlay: Record<number, string[]> = {};
        if (missingIds.length > 0) {
          const res = await getBarcodesForProducts(missingIds);
          if (res.error) throw new Error(res.error);
          overlay = res.data ?? {};
        }

        const stickers: LabelData[] = [];
        for (const it of req.items) {
          const qty = Math.max(0, Number(it.qty) || 0);
          if (qty <= 0) continue;
          const effectiveBarcodes = it.barcodes === null ? (overlay[it.idProduct] ?? []) : (it.barcodes ?? []);
          const primaryBarcode = effectiveBarcodes[0] ?? it.reference ?? String(it.idProduct);
          const label: LabelData = {
            nombreProducto: String(it.name ?? ""),
            codigoBarras: String(primaryBarcode ?? ""),
            lote: String(it.measurementUnit ?? ""),
            fecha: toIsoDate(it.createdAt),
          };
          for (let i = 0; i < qty; i++) stickers.push(label);
        }

        const plan: LabelSlot[][] = [];
        for (let i = 0; i < stickers.length; i += 3) {
          plan.push([stickers[i] ?? null, stickers[i + 1] ?? null, stickers[i + 2] ?? null]);
        }

        let idx = 0;
        let printedWithoutLogo = false;
        while (idx < plan.length) {
          if (abortRef.current.signal.aborted) throw new Error("Impresión detenida.");

          const rowLabels = plan[idx++];
          const buildZpl = (opts?: { disableLogo?: boolean }) =>
            generate3UpLabelsRow(rowLabels, {
              includeDefaultsHeader: true,
              logoZpl: opts?.disableLogo ? "" : getLogoZpl(),
              dpi: Number(process.env.NEXT_PUBLIC_ZEBRA_DPI ?? 203),
              includeBorder: false,
            });

          try {
            await sendZplWithRetry(printer, buildZpl(), {
              timeoutMs: 6000,
              retries: 2,
              retryDelayMs: 250,
              signal: abortRef.current.signal,
            });
          } catch (e: unknown) {
            const hadLogo = logoMode !== "off" && Boolean(getLogoZpl().trim());
            if (hadLogo) {
              try {
                printedWithoutLogo = true;
                await sendZplWithRetry(printer, buildZpl({ disableLogo: true }), {
                  timeoutMs: 6000,
                  retries: 1,
                  retryDelayMs: 250,
                  signal: abortRef.current.signal,
                });
                continue;
              } catch {
                // fallthrough
              }
            }

            throw new Error(
              e instanceof Error
                ? `Error al imprimir solicitud (fila ${idx}): ${e.message}`
                : `Error al imprimir solicitud (fila ${idx}): ${String(e)}`
            );
          }
        }

        const upd = await setPrintLabelRequestStatus({ requestId: req.requestId, status: "PRINTED" });
        if (!upd.ok) throw new Error(upd.error ?? "No se pudo marcar como impresa");

        // Remove from pending list.
        setRequests((prev) => prev.filter((x) => x.requestId !== req.requestId));

        if (printedWithoutLogo) {
          setMessage(`Solicitud ${rIndex + 1} impresa (sin logo por compatibilidad).`);
        }
      }

      setMessage("¡Todas las solicitudes fueron enviadas a impresión!");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setPrinting(false);
    }
  };

  const buildPrintPlanRows = (selectedIds: number[], barcodesOverlay: Record<number, string[]>): LabelSlot[][] => {
    // Qty means: number of STICKERS to print for that product.
    // We pack 3 stickers per row (left-to-right). The last row may contain empty slots.
    const stickers: LabelData[] = [];

    for (const idProduct of selectedIds) {
      const row = rows.find((r) => r.idProduct === idProduct);
      if (!row) continue;

      const qtyStickers = Math.max(0, Number(selected[idProduct] ?? 0) || 0);
      if (qtyStickers <= 0) continue;

      const label = buildLabelFromRow(row, barcodesOverlay);
      for (let i = 0; i < qtyStickers; i++) stickers.push(label);
    }

    const plan: LabelSlot[][] = [];
    for (let i = 0; i < stickers.length; i += 3) {
      plan.push([stickers[i] ?? null, stickers[i + 1] ?? null, stickers[i + 2] ?? null]);
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
      await ensureLogoSnippet();

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
    <div className="py-6 pl-4 pr-6 max-w-none">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Impresión de Etiquetas Zebra</h1>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:items-center">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="destructive" onClick={handleStopPrinting} disabled={!printing}>
              Detener impresión
            </Button>
            <Button onClick={preparePrintPreview} disabled={printing || selectedCount === 0 || previewLoading}>
              {previewLoading ? "Preparando preview..." : "Imprimir (ver preview)"}
            </Button>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRequestsOpen(true)}
                disabled={printing}
                className="relative"
              >
                Peticiones
                {requestsSummary.count > 0 ? (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] leading-[18px] text-center">
                    {requestsSummary.count}
                  </span>
                ) : null}
              </Button>

              <Button
                variant="outline"
                onClick={sendPrintRequest}
                disabled={printing || selectedCount === 0}
              >
                Enviar solicitud
              </Button>
            </div>
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
        <div className="grid gap-4">
          <div
            className="rounded-lg border bg-card overflow-x-hidden overflow-y-auto"
            onMouseLeave={() => setHoveredProductId(null)}
          >
            <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "44px" }} />
              <col style={{ width: "80px" }} />
              <col style={{ width: "1fr" }} />
              <col style={{ width: "180px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 w-10"></th>
                <th className="p-2 text-left whitespace-nowrap">ID</th>
                <th className="p-2 text-left whitespace-nowrap">Nombre</th>
                <th className="p-2 text-left whitespace-nowrap">Referencia</th>
                <th className="p-2 text-left whitespace-nowrap">Posición</th>
                <th className="p-2 text-left whitespace-nowrap">Fecha creación</th>
                <th className="p-2 text-left whitespace-nowrap">Stickers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const checked = Boolean(selected[r.idProduct]);
                const qty = selected[r.idProduct] ?? 1;

                return (
                  <tr
                    key={r.idProduct}
                    className="border-t hover:bg-muted/30 transition-colors"
                    onMouseEnter={() => setHoveredProductId(r.idProduct)}
                    onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
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

          {/* Extra scroll space so the last row hover popover has room to show */}
          <div aria-hidden className="h-56" />
        </div>
      )}

      {hoverMounted && hoverEnabled && hoveredRow
        ? createPortal(
            (() => {
              const pad = 12;
              const offset = 14;
              const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
              const vh = typeof window !== "undefined" ? window.innerHeight : 800;

              // Dead-zone near edges: if the cursor is too close to the bottom/right,
              // do not show the popover to avoid covering actions/content.
              const deadZoneRight = 220;
              const deadZoneBottom = 160;
              if (hoverPos.x > vw - deadZoneRight || hoverPos.y > vh - deadZoneBottom) {
                return null;
              }

              let left = hoverPos.x + offset;
              let top = hoverPos.y + offset;
              if (left + hoverPopoverSize.w + pad > vw) left = Math.max(pad, vw - hoverPopoverSize.w - pad);
              if (top + hoverPopoverSize.h + pad > vh) top = Math.max(pad, vh - hoverPopoverSize.h - pad);

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

              return (
                <div
                  ref={hoverPopoverRef}
                  style={{
                    position: "fixed",
                    left,
                    top,
                    zIndex: 80,
                    pointerEvents: "none",
                    width: 280,
                    maxWidth: "min(86vw, 320px)",
                  }}
                  className="rounded-xl border bg-background/90 shadow-2xl backdrop-blur-sm p-2"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" title={hoveredRow.name}>
                        {hoveredRow.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate" title={hoveredRow.reference ?? ""}>
                        Ref: {hoveredRow.reference ?? "—"}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground whitespace-nowrap">ID {hoveredRow.idProduct}</div>
                  </div>

                  <div className="grid gap-2">
                    <div className="bg-white border rounded-lg p-2">
                      {hoveredRow.barcodes === null ? (
                        <div className="text-sm text-muted-foreground">Cargando códigos…</div>
                      ) : hoveredRow.barcodes && hoveredRow.barcodes.length ? (
                        <div className="space-y-1">
                          <BarcodeSvg value={hoveredRow.barcodes[0]} height={34} barWidth={1} className="w-full" />
                          <div className="text-xs text-center text-muted-foreground truncate" title={hoveredRow.barcodes[0]}>
                            {hoveredRow.barcodes[0]}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Sin código de barras</div>
                      )}
                    </div>

                    <div>
                      <div className="overflow-hidden rounded-lg">
                        {renderStickerPreview(label, { widthPx: 220 })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })(),
            document.body
          )
        : null}

      <div className="flex items-center justify-between gap-4 mt-4">
        <div className="text-sm text-muted-foreground">
          Mostrando {rows.length} items (página de {pageSize}). Seleccionados: {selectedCount}. Se empacan 3 etiquetas por fila.
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {printing ? "Imprimiendo…" : ""}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={loading || page === 1 || printing}
            >
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {isSearching ? `Página ${page} (búsqueda)` : `Página ${page}`}
            </div>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || !hasNext || printing}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={(open) => (previewLoading || printing ? null : setPreviewOpen(open))}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Preview de impresión</DialogTitle>
            <DialogDescription>
              Se imprimirán {previewRows.length} filas (hasta {previewRows.length * 3} posiciones). Orden: izquierda→derecha, empezando arriba.
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

      <Dialog open={requestsOpen} onOpenChange={(open) => (printing ? null : setRequestsOpen(open))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Peticiones de impresión</DialogTitle>
            <DialogDescription>
              Pendientes: {requestsSummary.count} solicitudes ({requestsSummary.stickers} stickers). Lista actual: {draftSummary.products} productos ({draftSummary.stickers} stickers).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">Lista actual</div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {draftSummary.products} productos · {draftSummary.stickers} stickers
                </div>
              </div>
              {draftSummary.products === 0 ? (
                <div className="text-sm text-muted-foreground mt-2">
                  Vacía. Selecciona productos en la tabla y usa “Agregar a la lista”.
                </div>
              ) : (
                <div className="mt-2 max-h-48 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium py-1">Producto</th>
                        <th className="text-right font-medium py-1 w-20">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(draftList)
                        .sort((a, b) => a.idProduct - b.idProduct)
                        .map((it) => (
                          <tr key={it.idProduct} className="border-t">
                            <td className="py-1 pr-3 truncate" title={it.name}>
                              {it.name}
                            </td>
                            <td className="py-1 text-right tabular-nums">{it.qty}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">Solicitudes pendientes</div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {requestsSummary.count} solicitudes · {requestsSummary.stickers} stickers
                </div>
              </div>

              {requests.length === 0 ? (
                <div className="text-sm text-muted-foreground mt-2">No hay solicitudes pendientes.</div>
              ) : (
                <div className="mt-2 max-h-[45vh] overflow-auto space-y-3">
                  {requests.map((r, idx) => {
                    const itemsCount = r.items.length;
                    const stickers = r.items.reduce((s, it) => s + Math.max(0, Number(it.qty) || 0), 0);
                    const when = new Date(r.requestedAt);
                    return (
                      <div key={r.requestId} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">Solicitud #{idx + 1}</div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {when.toLocaleString()} · {itemsCount} productos · {stickers} stickers
                          </div>
                        </div>
                        <div className="mt-2">
                          <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                              <tr>
                                <th className="text-left font-medium py-1">Producto</th>
                                <th className="text-right font-medium py-1 w-20">Qty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.items
                                .slice()
                                .sort((a, b) => a.idProduct - b.idProduct)
                                .map((it) => (
                                  <tr key={it.idProduct} className="border-t">
                                    <td className="py-1 pr-3 truncate" title={it.name}>
                                      {it.name}
                                    </td>
                                    <td className="py-1 text-right tabular-nums">{it.qty}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={mergeSelectedIntoDraft} disabled={printing || previewLoading || selectedCount === 0}>
              Agregar a la lista
            </Button>
            <Button onClick={printRequestsNow} disabled={printing || requests.length === 0 || bp.status !== "ready" || !bp.selectedPrinter}>
              Imprimir
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
