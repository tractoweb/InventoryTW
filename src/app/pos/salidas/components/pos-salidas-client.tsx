"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Minus, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getWarehouses } from "@/actions/get-warehouses";
import { getDocumentTypes, type DocumentTypeListItem } from "@/actions/get-document-types";
import { findProductByBarcodeAction } from "@/actions/find-product-by-barcode";
import { getProductDetails } from "@/actions/get-product-details";
import { type ProductSearchResult } from "@/actions/search-products";
import { createDocumentAction } from "@/actions/create-document";
import { finalizeDocumentAction } from "@/actions/finalize-document";
import { listProductsCompactAction, type ProductCompact } from "@/actions/list-products-compact";

type SelectOption = { value: number; label: string };

type DraftSalidaItem = {
  productId: number;
  name: string;
  code?: string | null;
  quantity: number;
  unitCost: number;
  unitPrice: number;
};

function todayYmd(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeBarcode(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumberSafe(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLoose(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
}

function normalizeSearchKey(value: unknown): string {
  // Similar spirit to inventory-service normalization: accent-insensitive and token-friendly.
  return normalizeLoose(value).replace(/[^0-9A-Z]+/g, "");
}

export function PosSalidasClientPage({ userId }: { userId: number }) {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [warehouses, setWarehouses] = React.useState<SelectOption[]>([]);
  const [documentTypes, setDocumentTypes] = React.useState<DocumentTypeListItem[]>([]);

  const [warehouseId, setWarehouseId] = React.useState<number | "">("");
  const [documentTypeId, setDocumentTypeId] = React.useState<number | "">("");

  const [warehouseLabel, setWarehouseLabel] = React.useState<string>("Bodega");

  const searchRef = React.useRef<HTMLInputElement | null>(null);

  const [note, setNote] = React.useState("");
  const [items, setItems] = React.useState<DraftSalidaItem[]>([]);

  // Inline product search
  const [productQuery, setProductQuery] = React.useState("");
  const [productResults, setProductResults] = React.useState<ProductSearchResult[]>([]);

  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [catalogTruncated, setCatalogTruncated] = React.useState(false);
  const [catalog, setCatalog] = React.useState<ProductCompact[]>([]);
  const [catalogIndex, setCatalogIndex] = React.useState<
    Array<{ p: ProductCompact; key: string; codeKey: string; barcodesKey: string }>
  >([]);
  const [barcodeIndex, setBarcodeIndex] = React.useState<Map<string, ProductCompact[]>>(new Map());

  // Selected product details
  const [selectedProductId, setSelectedProductId] = React.useState<number | null>(null);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [detailsError, setDetailsError] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<any | null>(null);

  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [scannerError, setScannerError] = React.useState<string | null>(null);
  const [scannerCode, setScannerCode] = React.useState<string>("");
  const [scannerMatches, setScannerMatches] = React.useState<ProductSearchResult[]>([]);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const outDocTypes = React.useMemo(() => {
    const wid = typeof warehouseId === "number" ? warehouseId : null;
    return (documentTypes ?? [])
      .filter((dt) => Number(dt?.stockDirection ?? 0) < 0)
      .filter((dt) => (wid ? Number(dt?.warehouseId ?? 0) === wid : true));
  }, [documentTypes, warehouseId]);

  React.useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        const [whRes, dtRes] = await Promise.all([getWarehouses({ onlyEnabled: true }), getDocumentTypes()]);

        const whOpts: SelectOption[] = (whRes.data ?? []).map((w: any) => ({
          value: Number(w.idWarehouse),
          label: String(w.name ?? w.idWarehouse),
        }));

        setWarehouses(whOpts);
        setDocumentTypes(dtRes.data ?? []);

        // Preselect "Bodega" if present.
        const bodega = whOpts.find((w) => normalizeLoose(w.label) === "BODEGA");
        const chosen = bodega ?? whOpts[0] ?? null;
        if (chosen) {
          setWarehouseId(chosen.value);
          setWarehouseLabel(chosen.label);
        }

        // Load product catalog for local search.
        setCatalogLoading(true);
        setCatalogError(null);
        const cat = await listProductsCompactAction({ maxProducts: 8000, maxBarcodes: 25000 });
        if (cat?.error) {
          setCatalogError(String(cat.error));
        } else {
          const rows = (cat?.data ?? []) as ProductCompact[];
          setCatalog(rows);
          setCatalogTruncated(Boolean(cat?.truncated));
          const bi = new Map<string, ProductCompact[]>();
          for (const p of rows) {
            for (const b of p.barcodes ?? []) {
              const k = normalizeSearchKey(b);
              if (!k) continue;
              const arr = bi.get(k) ?? [];
              arr.push(p);
              bi.set(k, arr);
            }
          }
          setBarcodeIndex(bi);
          setCatalogIndex(
            rows.map((p) => ({
              p,
              key: normalizeSearchKey(p.name),
              codeKey: normalizeSearchKey(p.code ?? ""),
              barcodesKey: (p.barcodes ?? []).map((b) => normalizeSearchKey(b)).join(" "),
            }))
          );
        }
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: e?.message ?? "No se pudo cargar bodegas/tipos de documento",
        });
      } finally {
        setCatalogLoading(false);
        setLoading(false);
        // focus search once the UI is ready
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    }

    boot();
  }, [toast]);

  React.useEffect(() => {
    // Auto-select first available OUT doc type when warehouse changes.
    if (typeof warehouseId !== "number") {
      setDocumentTypeId("");
      return;
    }

    const available = outDocTypes;
    if (available.length === 0) {
      setDocumentTypeId("");
      return;
    }

    // Keep selection if still valid.
    const current = typeof documentTypeId === "number" ? documentTypeId : null;
    if (current && available.some((d) => Number(d.documentTypeId) === current)) return;

    // Prefer a "SALIDA" type when possible.
    const preferred = available.find((d) => normalizeLoose(d?.name).includes("SALIDA")) ?? available[0];
    setDocumentTypeId(Number(preferred.documentTypeId));
  }, [warehouseId, outDocTypes, documentTypeId]);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      const q = productQuery.trim();
      if (q.length < 2) {
        setProductResults([]);
        return;
      }

      const qKey = normalizeSearchKey(q);
      const qLoose = normalizeLoose(q);

      // Fast local search over cached catalog.
      const matches = catalogIndex
        .filter(({ p, key, codeKey, barcodesKey }) => {
          if (!p.isEnabled) return false;
          const idText = String(p.idProduct);
          if (idText.includes(qLoose)) return true;
          if (key.includes(qKey)) return true;
          if (codeKey.includes(qKey)) return true;
          if (barcodesKey.includes(qKey)) return true;
          return false;
        })
        .slice(0, 25)
        .map(({ p }) => ({
          idProduct: p.idProduct,
          name: p.name,
          code: p.code,
          cost: p.cost,
          price: p.price,
        }));

      setProductResults(matches);
    }, 120);

    return () => clearTimeout(handle);
  }, [productQuery, catalogIndex]);

  React.useEffect(() => {
    if (!selectedProductId) {
      setDetails(null);
      setDetailsError(null);
      return;
    }

    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError(null);
    setDetails(null);

    getProductDetails(selectedProductId)
      .then((res: any) => {
        if (cancelled) return;
        if (res?.error) throw new Error(String(res.error));
        const data = res?.data;
        if (!data?.success) throw new Error(String(data?.error ?? "No se pudo cargar el producto"));
        setDetails(data);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setDetailsError(e?.message ?? "No se pudo cargar el producto");
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProductId]);

  function addOrIncrement(product: { idProduct: number; name: string; code?: string | null; unitCost?: number | null; unitPrice?: number | null }) {
    const pid = Number(product.idProduct);
    if (!Number.isFinite(pid) || pid <= 0) return;

    const unitCost = toNumberSafe(product.unitCost, 0);
    const unitPrice = toNumberSafe(product.unitPrice, 0);

    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === pid);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.max(0, toNumberSafe(next[idx].quantity, 0) + 1) };
        return next;
      }

      return [
        ...prev,
        {
          productId: pid,
          name: String(product.name ?? ""),
          code: product.code ?? null,
          quantity: 1,
          unitCost: unitCost > 0 ? unitCost : 0,
          unitPrice: unitPrice > 0 ? unitPrice : 0,
        },
      ];
    });
  }

  async function handleScanValue(valueRaw: string) {
    const value = normalizeBarcode(valueRaw);
    if (!value) return;

    // Prefer local barcode exact match.
    const key = normalizeSearchKey(value);
    const matchesLocal = (barcodeIndex.get(key) ?? [])
      .slice(0, 25)
      .map((p) => ({ idProduct: p.idProduct, name: p.name, code: p.code, cost: p.cost, price: p.price }));

    if (matchesLocal.length === 1) {
      const p = matchesLocal[0];
      addOrIncrement({ idProduct: p.idProduct, name: p.name, code: p.code ?? null, unitCost: p.cost ?? 0, unitPrice: p.price ?? 0 });
      setSelectedProductId(Number(p.idProduct));
      setProductQuery("");
      setProductResults([]);
      setTimeout(() => searchRef.current?.focus(), 0);
      return;
    }

    if (matchesLocal.length > 1) {
      setProductQuery(value);
      setProductResults(matchesLocal);
      toast({ title: "Varios productos", description: "Selecciona el producto correcto en la lista." });
      return;
    }

    try {
      const found: any = await findProductByBarcodeAction(value);
      const idProduct = Number(found?.idProduct ?? 0);
      if (!Number.isFinite(idProduct) || idProduct <= 0) {
        toast({ variant: "destructive", title: "No encontrado", description: `Sin producto para código: ${value}` });
        return;
      }

      const details: any = await getProductDetails(idProduct);
      if (details?.error) throw new Error(String(details.error));

      const data = details?.data;
      if (!data?.success) throw new Error(String(data?.error ?? "No se pudo cargar el producto"));

      const p = data?.product ?? {};
      addOrIncrement({
        idProduct,
        name: String(p?.name ?? data?.name ?? `Producto ${idProduct}`),
        code: p?.code ?? data?.code ?? null,
        unitCost: p?.cost ?? data?.cost ?? p?.lastPurchasePrice ?? data?.lastpurchaseprice ?? 0,
        unitPrice: p?.price ?? data?.price ?? 0,
      });

      setSelectedProductId(idProduct);

      setProductQuery("");
      setProductResults([]);
      searchRef.current?.focus();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo procesar el código" });
    }
  }

  function addFromSearch(p: ProductSearchResult) {
    addOrIncrement({ idProduct: p.idProduct, name: p.name, code: p.code ?? null, unitCost: p.cost ?? 0, unitPrice: p.price ?? 0 });
    setSelectedProductId(Number(p.idProduct));
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function updateItem(idx: number, patch: Partial<DraftSalidaItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const totals = React.useMemo(() => {
    const totalLines = items.length;
    const totalQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    return { totalLines, totalQty };
  }, [items]);

  async function handleSaveSalida() {
    if (saving) return;
    if (typeof warehouseId !== "number") {
      toast({ variant: "destructive", title: "Falta bodega", description: "Seleccione una bodega." });
      return;
    }
    if (typeof documentTypeId !== "number") {
      toast({ variant: "destructive", title: "Sin tipo de salida", description: "No hay tipo de documento de salida configurado para la bodega." });
      return;
    }
    if (items.length === 0) {
      toast({ variant: "destructive", title: "Sin productos", description: "Agregue al menos un producto." });
      return;
    }

    setSaving(true);
    try {
      const res: any = await createDocumentAction({
        warehouseId,
        documentTypeId,
        date: todayYmd(),
        note: note.trim() || undefined,
        internalNote: "POS: SALIDA",
        items: items.map((it) => ({
          productId: it.productId,
          quantity: Math.max(0.0001, toNumberSafe(it.quantity, 0)),
          price: Math.max(0, toNumberSafe(it.unitPrice, 0)),
          productCost: toNumberSafe(it.unitCost, 0),
        })),
      } as any);

      if (!res?.success) throw new Error(String(res?.error ?? "No se pudo crear el documento"));

      const documentId = Number(res?.documentId ?? 0);
      if (!Number.isFinite(documentId) || documentId <= 0) {
        toast({ title: "Creado", description: "Documento creado. (Sin ID para finalizar)" });
        return;
      }

      const fin: any = await finalizeDocumentAction({ documentId, userId });
      if (!fin?.success) {
        throw new Error(String(fin?.error ?? "Documento creado pero no finalizado"));
      }

      toast({ title: "Salida registrada", description: `Documento ${res?.documentNumber ?? documentId} finalizado.` });

      setItems([]);
      setNote("");
      setTimeout(() => searchRef.current?.focus(), 0);

      // Update history and take user to PDF view quickly
      router.push(`/documents/${documentId}/pdf`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo guardar la salida" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Cargando POS…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salidas</h1>
          <p className="text-muted-foreground">Registra salidas rápidas escaneando o buscando productos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setItems([])} disabled={items.length === 0 || saving}>
            Limpiar
          </Button>
          <Button onClick={handleSaveSalida} disabled={saving}>
            {saving ? "Guardando…" : "Guardar salida"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Agregar artículos</CardTitle>
            <CardDescription>Digita nombre/código o escanea el código de barras.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Bodega</Label>
              <Input value={warehouseLabel} disabled />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-end justify-between gap-2">
                  <Label className="text-lg font-semibold">Buscar productos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setScannerOpen(true)}>
                    <Camera className="mr-2 h-4 w-4" />
                    Escáner
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Escribe nombre/código o escanea con el lector"
                    className="h-12 pl-10 text-base"
                    inputMode="text"
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const q = productQuery.trim();
                        if (!q) return;

                        // If barcode exact match, add it.
                        const k = normalizeSearchKey(q);
                        const byBarcode = (barcodeIndex.get(k) ?? [])
                          .slice(0, 25)
                          .map((p) => ({ idProduct: p.idProduct, name: p.name, code: p.code, cost: p.cost, price: p.price }));

                        if (byBarcode.length === 1) {
                          addFromSearch(byBarcode[0]);
                          setProductQuery("");
                          setProductResults([]);
                          return;
                        }

                        // If the search produced a single result, add it.
                        if (productResults.length === 1) {
                          addFromSearch(productResults[0]);
                          setProductQuery("");
                          setProductResults([]);
                          return;
                        }

                        // Otherwise, attempt remote barcode lookup (supports cases not present in local catalog).
                        void handleScanValue(q);
                      }
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {catalogLoading
                    ? "Cargando catálogo…"
                    : catalogError
                      ? `Catálogo no disponible: ${catalogError}`
                      : catalogTruncated
                        ? `Catálogo cargado (parcial): ${catalog.length} productos`
                        : `Catálogo cargado: ${catalog.length} productos`}
                </div>
              </div>
            </div>

            <div className="rounded-md border bg-muted/20">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="text-sm font-medium">Resultados</div>
                <div className="text-xs text-muted-foreground">
                  {productQuery.trim().length < 2 ? "Escribe mínimo 2 letras" : `${productResults.length} encontrado(s)`}
                </div>
              </div>
              <div className="max-h-[220px] overflow-auto divide-y">
                {productQuery.trim().length >= 2 && productResults.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Sin resultados.</div>
                ) : null}
                {productResults.map((p) => (
                  <button
                    key={p.idProduct}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted/40"
                    onClick={() => addFromSearch(p)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.code ? `${p.name} (${p.code})` : p.name}</div>
                        <div className="truncate text-xs text-muted-foreground">ID: {p.idProduct}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Precio</div>
                        <div className="text-sm font-medium tabular-nums">{Number(p.price ?? 0) || 0}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
            <CardDescription>Totales y nota de la salida.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border p-3">
              <div className="text-sm font-medium">Resumen</div>
              <div className="mt-2 grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Líneas</span>
                  <span className="font-medium">{totals.totalLines}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cantidad total</span>
                  <span className="font-medium">{totals.totalQty}</span>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <Label>Nota</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo / observaciones" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Carrito</CardTitle>
              <CardDescription>Selecciona una línea para ver detalles del producto.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">Producto</TableHead>
                    <TableHead className="w-[160px] text-center">Cantidad</TableHead>
                    <TableHead className="w-[220px]">Precio salida</TableHead>
                    <TableHead className="w-[200px]">Costo</TableHead>
                    <TableHead className="w-[140px] text-right">Total</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        Agrega productos con el buscador o el escáner.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((it, idx) => {
                      const active = selectedProductId === it.productId;
                      const total = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                      return (
                        <TableRow
                          key={`${it.productId}-${idx}`}
                          className={active ? "bg-muted/40" : ""}
                          onClick={() => setSelectedProductId(it.productId)}
                        >
                          <TableCell>
                            <div className="font-medium">{it.name}</div>
                            <div className="text-xs text-muted-foreground">ID {it.productId}{it.code ? ` · ${it.code}` : ""}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextQty = Math.max(0, (Number(it.quantity) || 0) - 1);
                                  updateItem(idx, { quantity: nextQty });
                                }}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                className="w-20 text-center"
                                value={String(it.quantity)}
                                onChange={(e) => updateItem(idx, { quantity: toNumberSafe(e.target.value, 0) })}
                                inputMode="decimal"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateItem(idx, { quantity: (Number(it.quantity) || 0) + 1 });
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={String(it.unitPrice ?? 0)}
                              onChange={(e) => updateItem(idx, { unitPrice: toNumberSafe(e.target.value, 0) })}
                              inputMode="decimal"
                              placeholder="0"
                              className="h-10 text-lg font-semibold tabular-nums"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={String(it.unitCost ?? 0)}
                              onChange={(e) => updateItem(idx, { unitCost: toNumberSafe(e.target.value, 0) })}
                              inputMode="decimal"
                              placeholder="0"
                              className="h-10 tabular-nums"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="text-xs text-muted-foreground">Total</div>
                            <div className="text-base font-semibold tabular-nums">{Number.isFinite(total) ? total : 0}</div>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem(idx);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
            <CardDescription>Guarda y genera Kardex/Stock.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleSaveSalida} disabled={saving} className="w-full">
              {saving ? "Guardando…" : "Guardar salida"}
            </Button>
            <Button variant="outline" onClick={() => searchRef.current?.focus()} className="w-full">
              Enfocar búsqueda
            </Button>
            <div className="text-xs text-muted-foreground">
              Al guardar se crea un documento y se finaliza (impacta Stock + Kardex).
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalles de producto seleccionado</CardTitle>
          <CardDescription>Historial y documentos relacionados.</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedProductId ? (
            <div className="text-sm text-muted-foreground">Selecciona un producto del carrito (o agrega uno) para ver detalles.</div>
          ) : detailsLoading ? (
            <div className="text-sm text-muted-foreground">Cargando detalles…</div>
          ) : detailsError ? (
            <div className="text-sm text-destructive">{detailsError}</div>
          ) : !details ? (
            <div className="text-sm text-muted-foreground">Sin datos.</div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-3">
                <div className="rounded-md border p-4">
                  <div className="text-lg font-semibold">{String(details?.product?.name ?? details?.name ?? "")}</div>
                  <div className="text-sm text-muted-foreground">
                    {details?.product?.code ?? details?.code ? `Código: ${String(details?.product?.code ?? details?.code)}` : ""}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Costo</div>
                      <div className="font-medium">{Number(details?.product?.cost ?? details?.cost ?? 0) || 0}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Precio</div>
                      <div className="font-medium">{Number(details?.product?.price ?? details?.price ?? 0) || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border">
                  <div className="px-4 py-3 border-b">
                    <div className="font-medium">Stock por bodega</div>
                  </div>
                  <div className="p-4">
                    {(details?.stocks ?? details?.stocklocations ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sin stock registrado.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bodega</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(details?.stocks ?? []).map((s: any, idx: number) => (
                            <TableRow key={`s-${idx}`}>
                              <TableCell>{String(s?.warehouseName ?? s?.warehousename ?? s?.warehouseId ?? "")}</TableCell>
                              <TableCell className="text-right">{Number(s?.quantity ?? 0) || 0}</TableCell>
                            </TableRow>
                          ))}
                          {(details?.stocks ? null : (details?.stocklocations ?? []).map((s: any, idx: number) => (
                            <TableRow key={`sl-${idx}`}>
                              <TableCell>{String(s?.warehousename ?? "")}</TableCell>
                              <TableCell className="text-right">{Number(s?.quantity ?? 0) || 0}</TableCell>
                            </TableRow>
                          )))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-md border">
                  <div className="px-4 py-3 border-b">
                    <div className="font-medium">Documentos relacionados</div>
                  </div>
                  <div className="p-4">
                    {(details?.relatedDocuments ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sin documentos relacionados.</div>
                    ) : (
                      <div className="w-full overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Número</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead className="w-[120px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(details?.relatedDocuments ?? []).slice(0, 10).map((d: any) => (
                              <TableRow key={Number(d?.documentId)}>
                                <TableCell className="font-medium">{String(d?.number ?? d?.documentId ?? "")}</TableCell>
                                <TableCell className="text-muted-foreground">{String(d?.stockDate ?? d?.createdAt ?? "").slice(0, 10)}</TableCell>
                                <TableCell>
                                  {d?.documentId ? (
                                    <Link
                                      href={`/documents/${Number(d.documentId)}/pdf`}
                                      className={buttonVariants({ variant: "outline", size: "sm" })}
                                    >
                                      Ver PDF
                                    </Link>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-md border">
                  <div className="px-4 py-3 border-b">
                    <div className="font-medium">Items recientes</div>
                  </div>
                  <div className="p-4">
                    {(details?.recentDocumentItems ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sin items recientes.</div>
                    ) : (
                      <div className="w-full overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Documento</TableHead>
                              <TableHead>Ref. electrónica</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead className="text-right">Cant.</TableHead>
                              <TableHead className="text-right">Costo</TableHead>
                              <TableHead className="text-right">Precio</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="w-[120px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(details?.recentDocumentItems ?? []).slice(0, 10).map((ri: any) => (
                              <TableRow key={Number(ri?.documentItemId ?? 0) || String(ri?.documentId ?? "") + String(ri?.createdAt ?? "") }>
                                <TableCell className="font-medium">
                                  {String(ri?.documentNumber ?? ri?.documentId ?? "")}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {String(ri?.referenceDocumentNumber ?? "")}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{String(ri?.date ?? ri?.createdAt ?? "").slice(0, 10)}</TableCell>
                                <TableCell className="text-right">{Number(ri?.quantity ?? 0) || 0}</TableCell>
                                <TableCell className="text-right">{Number(ri?.productCost ?? 0) || 0}</TableCell>
                                <TableCell className="text-right">{Number(ri?.price ?? 0) || 0}</TableCell>
                                <TableCell className="text-right">{Number(ri?.total ?? ((Number(ri?.quantity ?? 0) || 0) * (Number(ri?.price ?? 0) || 0))) || 0}</TableCell>
                                <TableCell>
                                  {ri?.documentId ? (
                                    <Link
                                      href={`/documents/${Number(ri.documentId)}/pdf`}
                                      className={buttonVariants({ variant: "outline", size: "sm" })}
                                    >
                                      Ver PDF
                                    </Link>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={scannerOpen}
        onOpenChange={(open) => {
          setScannerOpen(open);
          if (!open) {
            setScannerError(null);
            setScannerCode("");
            setScannerMatches([]);
            if (rafRef.current) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            if (streamRef.current) {
              for (const t of streamRef.current.getTracks()) t.stop();
              streamRef.current = null;
            }
            setTimeout(() => searchRef.current?.focus(), 0);
          }
        }}
      >
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Escáner de cámara</DialogTitle>
            <DialogDescription>Apunta al código de barras. Si hay múltiples coincidencias, selecciona el producto.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-2">
              <div className="rounded-md border bg-black/5 overflow-hidden">
                <video ref={videoRef} className="w-full max-h-[420px] object-contain" autoPlay playsInline muted />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={async () => {
                    setScannerError(null);
                    setScannerMatches([]);
                    setScannerCode("");

                    try {
                      if (!navigator?.mediaDevices?.getUserMedia) {
                        throw new Error("El navegador no soporta cámara (getUserMedia).");
                      }

                      const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "environment" },
                        audio: false,
                      });

                      streamRef.current = stream;
                      if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        await videoRef.current.play();
                      }

                      const AnyBarcodeDetector = (globalThis as any).BarcodeDetector as any;
                      if (!AnyBarcodeDetector) {
                        throw new Error("Este navegador no soporta BarcodeDetector. Usa el lector como teclado.");
                      }

                      const detector = new AnyBarcodeDetector();

                      const loop = async () => {
                        try {
                          if (!videoRef.current) return;
                          const video = videoRef.current;
                          if (video.readyState < 2) {
                            rafRef.current = requestAnimationFrame(loop);
                            return;
                          }

                          const codes = await detector.detect(video);
                          const raw = String(codes?.[0]?.rawValue ?? "").trim();
                          if (raw) {
                            setScannerCode(raw);
                            const key = normalizeSearchKey(raw);
                            const matches = catalog
                              .filter((p) => (p.barcodes ?? []).some((b) => normalizeSearchKey(b) === key))
                              .slice(0, 25)
                              .map((p) => ({
                                idProduct: p.idProduct,
                                name: p.name,
                                code: p.code,
                                cost: p.cost,
                                price: p.price,
                              }));
                            setScannerMatches(matches);
                          }
                        } catch {
                          // ignore transient detection errors
                        }
                        rafRef.current = requestAnimationFrame(loop);
                      };

                      rafRef.current = requestAnimationFrame(loop);
                    } catch (e: any) {
                      setScannerError(e?.message ?? "No se pudo iniciar la cámara.");
                    }
                  }}
                >
                  Iniciar cámara
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (rafRef.current) {
                      cancelAnimationFrame(rafRef.current);
                      rafRef.current = null;
                    }
                    if (streamRef.current) {
                      for (const t of streamRef.current.getTracks()) t.stop();
                      streamRef.current = null;
                    }
                  }}
                >
                  Detener
                </Button>
              </div>

              {scannerError ? <div className="text-sm text-destructive">{scannerError}</div> : null}
            </div>

            <div className="space-y-3">
              <div className="rounded-md border p-3">
                <div className="text-sm font-medium">Código detectado</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{scannerCode || "—"}</div>
              </div>

              <div className="rounded-md border">
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <div className="text-sm font-medium">Resultados</div>
                  <div className="text-xs text-muted-foreground">{scannerMatches.length} encontrado(s)</div>
                </div>
                <div className="max-h-[320px] overflow-auto divide-y">
                  {scannerCode && scannerMatches.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">Sin coincidencias en el catálogo.</div>
                  ) : null}
                  {scannerMatches.map((p) => (
                    <button
                      key={`scan-${p.idProduct}`}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/40"
                      onClick={() => {
                        addFromSearch(p);
                        setScannerOpen(false);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.code ? `${p.name} (${p.code})` : p.name}</div>
                          <div className="truncate text-xs text-muted-foreground">ID: {p.idProduct}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Precio</div>
                          <div className="text-sm font-medium tabular-nums">{Number(p.price ?? 0) || 0}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
