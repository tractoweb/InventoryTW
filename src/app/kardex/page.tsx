"use client";

import * as React from 'react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, RefreshCw } from 'lucide-react';

import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';

import { getWarehouses } from '@/actions/get-warehouses';
import { searchProductsAction, type ProductSearchResult } from '@/actions/search-products';
import { getKardexEntriesAction, type KardexEntryRow } from '@/actions/get-kardex-entries';
import { getProductDetails } from '@/actions/get-product-details';
import { KardexEntryDetailsSheet } from './components/kardex-entry-details-sheet';
import { KardexDocumentDialog } from './components/kardex-document-dialog';

type WarehouseOption = { value: string; label: string };

function fmtMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

function TypeBadge({ type }: { type: KardexEntryRow['type'] }) {
  const label = type === 'ENTRADA' ? 'Entrada' : type === 'SALIDA' ? 'Salida' : 'Ajuste';
  const cls =
    type === 'ENTRADA'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : type === 'SALIDA'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <Badge variant="outline" className={cls}>
      {label}
    </Badge>
  );
}

export default function KardexPage() {
  const { toast } = useToast();

  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const [warehouseOptions, setWarehouseOptions] = React.useState<WarehouseOption[]>([
    { value: 'all', label: 'Todas' },
  ]);
  const [warehouseId, setWarehouseId] = React.useState<string>('all');

  const [type, setType] = React.useState<'all' | 'ENTRADA' | 'SALIDA' | 'AJUSTE'>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');

  const [quickQuery, setQuickQuery] = React.useState<string>('');
  const dQuickQuery = useDebounce(quickQuery, 150);

  const [productQuery, setProductQuery] = React.useState('');
  const debouncedProductQuery = useDebounce(productQuery, 250);
  const [productResults, setProductResults] = React.useState<ProductSearchResult[]>([]);
  const [productSearching, setProductSearching] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<ProductSearchResult | null>(null);

  const productBoxRef = React.useRef<HTMLDivElement | null>(null);

  const [productDropdownOpen, setProductDropdownOpen] = React.useState(false);
  const [productActiveIndex, setProductActiveIndex] = React.useState(-1);
  const topProductResults = React.useMemo(() => productResults.slice(0, 10), [productResults]);

  const [loading, setLoading] = React.useState(true);
  const [entries, setEntries] = React.useState<KardexEntryRow[]>([]);
  const [nextToken, setNextToken] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsEntry, setDetailsEntry] = React.useState<KardexEntryRow | null>(null);
  const [detailsTab, setDetailsTab] = React.useState<"movement" | "document">("movement");

  const [docDialogOpen, setDocDialogOpen] = React.useState(false);
  const [docDialogEntry, setDocDialogEntry] = React.useState<KardexEntryRow | null>(null);
  const [docDialogView, setDocDialogView] = React.useState<"pdf" | "print">("pdf");

  React.useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        const wh = await getWarehouses({ onlyEnabled: true });
        const options: WarehouseOption[] = [
          { value: 'all', label: 'Todas' },
          ...(wh.data ?? []).map((w: any) => ({
            value: String(w.idWarehouse),
            label: String(w.name ?? w.idWarehouse),
          })),
        ];
        setWarehouseOptions(options);
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudieron cargar bodegas' });
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, [toast]);

  React.useEffect(() => {
    let cancelled = false;
    async function search() {
      setProductSearching(true);
      const res = await searchProductsAction(debouncedProductQuery, 20);
      if (cancelled) return;
      setProductResults(res.data ?? []);
      setProductSearching(false);
    }

    // Only search when user starts typing.
    if (debouncedProductQuery.trim().length >= 1) search();
    else setProductResults([]);

    // Reset highlight when query changes.
    setProductActiveIndex(-1);

    return () => {
      cancelled = true;
    };
  }, [debouncedProductQuery]);

  React.useEffect(() => {
    function onMouseDown(ev: MouseEvent) {
      const el = productBoxRef.current;
      if (!el) return;
      if (el.contains(ev.target as Node)) return;
      setProductDropdownOpen(false);
      setProductActiveIndex(-1);
    }

    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function selectProduct(p: ProductSearchResult) {
    const label = p.code ? `${p.name} (${p.code})` : p.name;
    setSelectedProduct(p);
    setProductQuery(label);
    setProductResults([]);
    setProductDropdownOpen(false);
    setProductActiveIndex(-1);
  }

  async function selectProductById(productId: number) {
    if (!Number.isFinite(productId) || productId <= 0) return;

    setProductSearching(true);
    try {
      const res: any = await getProductDetails(productId);
      const details = res?.data;
      const p = details?.product;
      if (!p || !Number.isFinite(Number(p.idProduct))) {
        toast({ variant: 'destructive', title: 'No encontrado', description: `No existe el producto ID ${productId}` });
        return;
      }

      selectProduct({
        idProduct: Number(p.idProduct),
        name: String(p.name ?? ''),
        code: p.code ?? null,
        cost: p.cost ?? null,
        price: p.price ?? null,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudo cargar el producto' });
    } finally {
      setProductSearching(false);
    }
  }

  const filtersKey = React.useMemo(() => {
    return JSON.stringify({
      productId: selectedProduct?.idProduct ?? null,
      warehouseId,
      type,
      dateFrom,
      dateTo,
      refreshNonce,
    });
  }, [selectedProduct?.idProduct, warehouseId, type, dateFrom, dateTo, refreshNonce]);

  function toIsoStartOfDay(dateOnly: string): string | undefined {
    const d = String(dateOnly ?? '').trim();
    if (!d) return undefined;
    // Keep local day boundaries stable.
    const dt = new Date(`${d}T00:00:00.000`);
    return Number.isFinite(dt.getTime()) ? dt.toISOString() : undefined;
  }

  function toIsoEndOfDay(dateOnly: string): string | undefined {
    const d = String(dateOnly ?? '').trim();
    if (!d) return undefined;
    const dt = new Date(`${d}T23:59:59.999`);
    return Number.isFinite(dt.getTime()) ? dt.toISOString() : undefined;
  }

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await getKardexEntriesAction({
        productId: selectedProduct?.idProduct,
        warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
        type: type === 'all' ? undefined : type,
        dateFrom: toIsoStartOfDay(dateFrom),
        dateTo: toIsoEndOfDay(dateTo),
        limit: 250,
        nextToken: undefined,
      });
      if (cancelled) return;
      if (res.error) {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
        setEntries([]);
        setNextToken(null);
      } else {
        setEntries(res.data ?? []);
        setNextToken(res.nextToken ?? null);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filtersKey, toast]);

  async function loadMore() {
    if (loading || loadingMore) return;
    if (!nextToken) return;

    setLoadingMore(true);
    try {
      const res = await getKardexEntriesAction({
        productId: selectedProduct?.idProduct,
        warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
        type: type === 'all' ? undefined : type,
        dateFrom: toIsoStartOfDay(dateFrom),
        dateTo: toIsoEndOfDay(dateTo),
        limit: 250,
        nextToken,
      });

      if (res.error) {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
        return;
      }

      const incoming = res.data ?? [];

      setEntries((prev) => {
        const byId = new Map<number, KardexEntryRow>();
        for (const e of prev ?? []) byId.set(e.kardexId, e);
        for (const e of incoming) byId.set(e.kardexId, e);
        return Array.from(byId.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });

      setNextToken(res.nextToken ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kardex (Auditoría)</h1>
          <p className="text-muted-foreground">
            Historial de movimientos por producto con trazabilidad al documento origen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => setRefreshNonce((n) => n + 1)}
            title="Refrescar resultados"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refrescar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Selecciona un producto (opcional) y filtra por bodega/fechas/tipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <div className="text-sm text-muted-foreground mb-1">Producto</div>
            <div className="relative" ref={productBoxRef}>
              <Input
                placeholder="Busca por nombre o código…"
                value={productQuery}
                autoComplete="off"
                onFocus={() => {
                  if (productQuery.trim().length > 0) setProductDropdownOpen(true);
                }}
                onChange={(e) => {
                  const v = e.target.value;
                  setProductQuery(v);
                  setProductDropdownOpen(v.trim().length > 0);
                }}
                onKeyDown={(e) => {
                  const canShow = productQuery.trim().length > 0;
                  const options = topProductResults;

                  if (e.key === 'Escape') {
                    setProductDropdownOpen(false);
                    setProductActiveIndex(-1);
                    return;
                  }

                  if (e.key === 'ArrowDown') {
                    if (!canShow) return;
                    e.preventDefault();
                    setProductDropdownOpen(true);
                    setProductActiveIndex((i) => {
                      const next = i + 1;
                      return next >= options.length ? 0 : next;
                    });
                    return;
                  }

                  if (e.key === 'ArrowUp') {
                    if (!canShow) return;
                    e.preventDefault();
                    setProductDropdownOpen(true);
                    setProductActiveIndex((i) => {
                      const next = i - 1;
                      return next < 0 ? Math.max(0, options.length - 1) : next;
                    });
                    return;
                  }

                  if (e.key === 'Enter') {
                    // Prefer selecting from dropdown, but also allow selecting the first match,
                    // or direct lookup by numeric Product ID.
                    const raw = productQuery.trim();
                    const normalizedId = Number(raw.replace(/^#/, ''));

                    if (productDropdownOpen) {
                      const idx = productActiveIndex >= 0 ? productActiveIndex : 0;
                      const chosen = options[idx];
                      if (chosen) {
                        e.preventDefault();
                        selectProduct(chosen);
                        return;
                      }
                    }

                    if (Number.isFinite(normalizedId) && normalizedId > 0) {
                      e.preventDefault();
                      selectProductById(normalizedId);
                      return;
                    }

                    // If dropdown was closed but we have results, select first result.
                    if (!productDropdownOpen && options.length > 0) {
                      e.preventDefault();
                      selectProduct(options[0]);
                      return;
                    }
                  }
                }}
              />

              {productDropdownOpen ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                  <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                    {productSearching
                      ? 'Buscando…'
                      : topProductResults.length === 0
                        ? 'Sin resultados'
                        : `Mostrando ${topProductResults.length} de ${productResults.length} (Enter para seleccionar)`}
                  </div>
                  <div className="divide-y max-h-[280px] overflow-auto">
                    {topProductResults.map((p, idx) => {
                      const active = idx === productActiveIndex;
                      return (
                        <button
                          key={p.idProduct}
                          type="button"
                          className={
                            "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground " +
                            (active ? 'bg-accent text-accent-foreground' : '')
                          }
                          onMouseDown={(ev) => {
                            // Prevent input blur before click.
                            ev.preventDefault();
                          }}
                          onMouseEnter={() => setProductActiveIndex(idx)}
                          onClick={() => selectProduct(p)}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {p.code ? `${p.code} · ID ${p.idProduct}` : `ID ${p.idProduct}`}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {(() => {
                    const raw = productQuery.trim();
                    const numeric = Number(raw.replace(/^#/, ''));
                    const canSuggest = raw.length > 0 && Number.isFinite(numeric) && numeric > 0;
                    const alreadyThere = productResults.some((p) => Number(p.idProduct) === Number(numeric));
                    if (!canSuggest || alreadyThere) return null;

                    return (
                      <div className="border-t px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-sm"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => selectProductById(numeric)}
                          disabled={productSearching}
                        >
                          Seleccionar ID {numeric}
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>
            {selectedProduct ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="text-xs text-muted-foreground">Seleccionado: ID {selectedProduct.idProduct}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedProduct(null);
                    setProductQuery('');
                    setProductDropdownOpen(false);
                    setProductActiveIndex(-1);
                  }}
                >
                  Quitar
                </Button>
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Bodega</div>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Bodega" />
              </SelectTrigger>
              <SelectContent>
                {warehouseOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Tipo</div>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ENTRADA">Entrada</SelectItem>
                <SelectItem value="SALIDA">Salida</SelectItem>
                <SelectItem value="AJUSTE">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Desde</div>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Hasta</div>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="md:col-span-6">
            <div className="text-sm text-muted-foreground mb-1">Buscar en resultados</div>
            <Input
              placeholder="Documento, nota/motivo, código, nombre…"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
          <CardDescription>
            Click en “PDF/Print” para abrir el documento origen (si aplica).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-2">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : (
            <div className="w-full overflow-auto rounded-md border">
              <TooltipProvider>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-[170px] bg-background">Fecha</TableHead>
                    <TableHead className="w-[110px] bg-background">Tipo</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-[170px] bg-background">Bodega</TableHead>
                    <TableHead className="w-[90px] text-right bg-background">Δ</TableHead>
                    <TableHead className="w-[90px] text-right bg-background">Antes</TableHead>
                    <TableHead className="w-[90px] text-right bg-background">Saldo</TableHead>
                    <TableHead className="bg-background">Documento</TableHead>
                    <TableHead className="w-[120px] text-right bg-background">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const q = String(dQuickQuery ?? '').trim().toLowerCase();
                    if (!q) return entries;
                    return (entries ?? []).filter((e) => {
                      const hay = [
                        e.productName,
                        e.productCode,
                        e.documentNumber,
                        e.documentId ? String(e.documentId) : null,
                        e.note,
                        e.type,
                        e.warehouseName,
                      ]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
                      return hay.includes(q);
                    });
                  })().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                        No hay movimientos con estos filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (() => {
                      const q = String(dQuickQuery ?? '').trim().toLowerCase();
                      const list = !q
                        ? entries
                        : (entries ?? []).filter((e) => {
                            const hay = [
                              e.productName,
                              e.productCode,
                              e.documentNumber,
                              e.documentId ? String(e.documentId) : null,
                              e.note,
                              e.type,
                              e.warehouseName,
                            ]
                              .filter(Boolean)
                              .join(' ')
                              .toLowerCase();
                            return hay.includes(q);
                          });

                      return list.map((e) => {
                      const productLabel = e.productCode ? `${e.productName ?? ''} (${e.productCode})` : e.productName ?? `#${e.productId}`;
                      const docLabel = e.documentNumber ?? (e.documentId ? `Doc #${e.documentId}` : '—');

                      const qty = Number(e.quantity ?? 0) || 0;
                      const signedQty = e.type === 'SALIDA' ? -Math.abs(qty) : Math.abs(qty);
                      const before = (Number(e.balance ?? 0) || 0) - signedQty;
                      const deltaText = `${signedQty > 0 ? '+' : ''}${fmtMoney(signedQty)}`;
                      const deltaClass = signedQty > 0 ? 'text-emerald-700' : signedQty < 0 ? 'text-red-700' : '';

                      return (
                        <TableRow key={e.kardexId}>
                          <TableCell className="whitespace-nowrap">{e.date ? new Date(e.date).toLocaleString('es-CO') : ''}</TableCell>
                          <TableCell><TypeBadge type={e.type} /></TableCell>
                          <TableCell className="max-w-[320px] truncate" title={productLabel}>
                            {productLabel}
                          </TableCell>
                          <TableCell>{e.warehouseName ?? (e.warehouseId ? `#${e.warehouseId}` : '—')}</TableCell>
                          <TableCell className={`text-right ${deltaClass}`}>{deltaText}</TableCell>
                          <TableCell className="text-right">{fmtMoney(before)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(e.balance)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm truncate max-w-[260px]" title={docLabel}>{docLabel}</span>
                              {e.documentId ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      // Open the large document dialog directly (no Sheet).
                                      setDocDialogEntry(e);
                                      setDocDialogView("pdf");
                                      setDocDialogOpen(true);
                                    }}
                                  >
                                    PDF
                                  </Button>
                                </>
                              ) : null}

                              {e.note ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <Info className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[420px]">
                                    <div className="text-sm whitespace-pre-wrap">{e.note}</div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDetailsEntry(e);
                                setDetailsTab("movement");
                                setDetailsOpen(true);
                              }}
                            >
                              Detalles
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                      });
                    })()
                  )}
                </TableBody>
              </Table>
              </TooltipProvider>
            </div>
          )}

          {!loading ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">Mostrando {entries.length} movimientos</div>
              <Button
                type="button"
                variant="outline"
                onClick={loadMore}
                disabled={!nextToken || loadingMore}
                title={!nextToken ? 'No hay más resultados' : 'Cargar más'}
              >
                {loadingMore ? 'Cargando…' : nextToken ? 'Cargar más' : 'Sin más resultados'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <KardexEntryDetailsSheet
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setDetailsEntry(null);
            setDetailsTab("movement");
          }
        }}
        entry={detailsEntry}
        defaultTab={detailsTab}
        onOpenDocument={({ entry, view }: { entry: KardexEntryRow; view: "pdf" | "print" }) => {
          setDocDialogEntry(entry);
          setDocDialogView(view);
          setDocDialogOpen(true);
        }}
      />

      <KardexDocumentDialog
        open={docDialogOpen}
        onOpenChange={(open) => {
          setDocDialogOpen(open);
          if (!open) {
            setDocDialogEntry(null);
            setDocDialogView("pdf");
          }
        }}
        entry={docDialogEntry}
        view={docDialogView}
        onViewChange={setDocDialogView}
      />
    </div>
  );
}
