"use client";

import * as React from 'react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';

import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';

import { getWarehouses } from '@/actions/get-warehouses';
import { searchProductsAction, type ProductSearchResult } from '@/actions/search-products';
import { getKardexEntriesAction, type KardexEntryRow } from '@/actions/get-kardex-entries';

type WarehouseOption = { value: string; label: string };

function fmtMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

export default function KardexPage() {
  const { toast } = useToast();

  const [warehouseOptions, setWarehouseOptions] = React.useState<WarehouseOption[]>([
    { value: 'all', label: 'Todas' },
  ]);
  const [warehouseId, setWarehouseId] = React.useState<string>('all');

  const [type, setType] = React.useState<'all' | 'ENTRADA' | 'SALIDA' | 'AJUSTE'>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');

  const [productQuery, setProductQuery] = React.useState('');
  const debouncedProductQuery = useDebounce(productQuery, 250);
  const [productResults, setProductResults] = React.useState<ProductSearchResult[]>([]);
  const [productSearching, setProductSearching] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<ProductSearchResult | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [entries, setEntries] = React.useState<KardexEntryRow[]>([]);

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

    return () => {
      cancelled = true;
    };
  }, [debouncedProductQuery]);

  const filtersKey = React.useMemo(() => {
    return JSON.stringify({
      productId: selectedProduct?.idProduct ?? null,
      warehouseId,
      type,
      dateFrom,
      dateTo,
    });
  }, [selectedProduct?.idProduct, warehouseId, type, dateFrom, dateTo]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await getKardexEntriesAction({
        productId: selectedProduct?.idProduct,
        warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
        type: type === 'all' ? undefined : type,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
        limit: 250,
      });
      if (cancelled) return;
      if (res.error) {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
        setEntries([]);
      } else {
        setEntries(res.data ?? []);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filtersKey, toast]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kardex (Auditoría)</h1>
          <p className="text-muted-foreground">
            Historial de movimientos por producto con trazabilidad al documento origen.
          </p>
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
            <Command className="rounded-lg border">
              <CommandInput
                placeholder="Busca por nombre o código…"
                value={productQuery}
                onValueChange={setProductQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {productSearching ? 'Buscando…' : 'Sin resultados'}
                </CommandEmpty>
                <CommandGroup heading="Resultados">
                  {productResults.map((p) => {
                    const label = p.code ? `${p.name} (${p.code})` : p.name;
                    return (
                      <CommandItem
                        key={p.idProduct}
                        value={label}
                        onSelect={() => {
                          setSelectedProduct(p);
                          setProductQuery(label);
                          setProductResults([]);
                        }}
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{p.code ?? `ID ${p.idProduct}`}</div>
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Bodega</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Costo U</TableHead>
                    <TableHead className="text-right">Costo T</TableHead>
                    <TableHead className="text-right">Precio U</TableHead>
                    <TableHead>Documento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                        No hay movimientos con estos filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((e) => {
                      const productLabel = e.productCode ? `${e.productName ?? ''} (${e.productCode})` : e.productName ?? `#${e.productId}`;
                      const docLabel = e.documentNumber ?? (e.documentId ? `Doc #${e.documentId}` : '—');
                      return (
                        <TableRow key={e.kardexId}>
                          <TableCell className="whitespace-nowrap">{e.date ? new Date(e.date).toLocaleString('es-CO') : ''}</TableCell>
                          <TableCell>{e.type}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={productLabel}>
                            {productLabel}
                          </TableCell>
                          <TableCell>{e.warehouseName ?? (e.warehouseId ? `#${e.warehouseId}` : '—')}</TableCell>
                          <TableCell className="text-right">{fmtMoney(e.quantity)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(e.balance)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(e.unitCost)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(e.totalCost)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(e.unitPrice)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{docLabel}</span>
                              {e.documentId ? (
                                <>
                                  <Button asChild variant="outline" size="sm">
                                    <Link href={`/documents/${e.documentId}/pdf`} target="_blank">
                                      PDF
                                    </Link>
                                  </Button>
                                  <Button asChild variant="ghost" size="sm">
                                    <Link href={`/documents/${e.documentId}/print`} target="_blank">
                                      Print
                                    </Link>
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
