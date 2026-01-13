'use client';

import * as React from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

import { getCustomers } from '@/actions/get-customers';
import { getWarehouses } from '@/actions/get-warehouses';
import { getDocumentTypes } from '@/actions/get-document-types';
import { searchProductsAction, type ProductSearchResult } from '@/actions/search-products';
import { createDocumentAction } from '@/actions/create-document';
import { finalizeDocumentAction } from '@/actions/finalize-document';

type SelectOption = { value: number; label: string };

type DraftItem = {
  productId: number;
  productLabel: string;
  quantity: number;
  price: number;
};

export function NewDocumentForm() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [finalizing, setFinalizing] = React.useState(false);

  const [customers, setCustomers] = React.useState<SelectOption[]>([]);
  const [warehouses, setWarehousesState] = React.useState<SelectOption[]>([]);
  const [documentTypes, setDocumentTypesState] = React.useState<SelectOption[]>([]);

  const [warehouseId, setWarehouseId] = React.useState<number | ''>('');
  const [documentTypeId, setDocumentTypeId] = React.useState<number | ''>('');
  const [customerId, setCustomerId] = React.useState<number | ''>('');

  const [date, setDate] = React.useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [referenceDocumentNumber, setReferenceDocumentNumber] = React.useState('');
  const [note, setNote] = React.useState('');

  const [items, setItems] = React.useState<DraftItem[]>([]);

  // Product search dialog
  const [productDialogOpen, setProductDialogOpen] = React.useState(false);
  const [productQuery, setProductQuery] = React.useState('');
  const [productResults, setProductResults] = React.useState<ProductSearchResult[]>([]);
  const [productSearching, setProductSearching] = React.useState(false);

  const total = React.useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);
  }, [items]);

  React.useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        const [cust, wh, dt] = await Promise.all([
          getCustomers({ onlyEnabled: true, onlySuppliers: true }),
          getWarehouses({ onlyEnabled: true }),
          getDocumentTypes(),
        ]);

        setCustomers(
          (cust.data ?? []).map((c: any) => ({ value: Number(c.idCustomer), label: String(c.name) }))
        );

        setWarehousesState(
          (wh.data ?? []).map((w: any) => ({ value: Number(w.idWarehouse), label: String(w.name) }))
        );

        setDocumentTypesState(
          (dt.data ?? []).map((d: any) => ({ value: Number(d.documentTypeId), label: String(d.name) }))
        );
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudo cargar data' });
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, [toast]);

  React.useEffect(() => {
    const handle = setTimeout(async () => {
      const q = productQuery.trim();
      if (!productDialogOpen) return;
      if (q.length < 2) {
        setProductResults([]);
        return;
      }

      setProductSearching(true);
      const res = await searchProductsAction(q, 30);
      setProductResults(res.data ?? []);
      setProductSearching(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [productQuery, productDialogOpen]);

  function addProduct(p: ProductSearchResult) {
    const label = p.code ? `${p.name} (${p.code})` : p.name;
    setItems((prev) => [
      ...prev,
      {
        productId: p.idProduct,
        productLabel: label,
        quantity: 1,
        price: Number(p.price ?? 0),
      },
    ]);
    setProductDialogOpen(false);
    setProductQuery('');
    setProductResults([]);
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(finalize: boolean) {
    if (!warehouseId || !documentTypeId) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Selecciona Almacén y Tipo de documento.' });
      return;
    }
    if (items.length === 0) {
      toast({ variant: 'destructive', title: 'Sin items', description: 'Agrega al menos 1 item.' });
      return;
    }

    setSaving(!finalize);
    setFinalizing(finalize);

    try {
      const created = await createDocumentAction({
        userId: 1,
        customerId: customerId ? Number(customerId) : undefined,
        warehouseId: Number(warehouseId),
        documentTypeId: Number(documentTypeId),
        date,
        referenceDocumentNumber: referenceDocumentNumber || undefined,
        note: note || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          price: it.price,
        })),
      });

      if (!created.success || !created.documentId) {
        throw new Error(created.error || 'No se pudo crear el documento');
      }

      if (finalize) {
        const fin = await finalizeDocumentAction({ documentId: created.documentId, userId: 1 });
        if (!fin.success) {
          throw new Error(fin.error || 'No se pudo finalizar el documento');
        }
      }

      toast({
        title: finalize ? 'Documento finalizado' : 'Documento guardado',
        description: created.documentNumber ? `Número: ${created.documentNumber}` : 'OK',
      });

      // Redirect back to documents list
      window.location.href = '/documents';
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'Error inesperado' });
    } finally {
      setSaving(false);
      setFinalizing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo documento</h1>
          <p className="text-muted-foreground">Ingreso/Salida con impacto en stock y kardex.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/documents">Volver</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Encabezado</CardTitle>
          <CardDescription>Selecciona almacén, tipo, proveedor y fecha.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Almacén</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
              disabled={loading}
            >
              <option value="">Selecciona…</option>
              {warehouses.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Tipo de documento</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={documentTypeId}
              onChange={(e) => setDocumentTypeId(e.target.value ? Number(e.target.value) : '')}
              disabled={loading}
            >
              <option value="">Selecciona…</option>
              {documentTypes.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Proveedor</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
              disabled={loading}
            >
              <option value="">(Opcional)</option>
              {customers.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label>Número de referencia (factura/guía)</Label>
            <Input value={referenceDocumentNumber} onChange={(e) => setReferenceDocumentNumber(e.target.value)} />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label>Nota</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Items</CardTitle>
            <CardDescription>Agrega productos, cantidad y precio.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setProductDialogOpen(true)} disabled={loading}>
              Agregar producto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin items todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Producto</th>
                    <th className="py-2 text-right font-medium">Cantidad</th>
                    <th className="py-2 text-right font-medium">Precio</th>
                    <th className="py-2 text-right font-medium">Subtotal</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={`${it.productId}-${idx}`} className="border-b">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{it.productLabel}</div>
                        <div className="text-xs text-muted-foreground">ID: {it.productId}</div>
                      </td>
                      <td className="py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          className="w-24 text-right"
                          value={String(it.quantity)}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          className="w-28 text-right"
                          value={String(it.price)}
                          onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 text-right font-medium">
                        {((Number(it.quantity) || 0) * (Number(it.price) || 0)).toFixed(2)}
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                          Quitar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-end gap-6 pt-2">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-lg font-semibold">{total.toFixed(2)}</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving || finalizing || loading}>
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving || finalizing || loading}>
              {finalizing ? 'Finalizando…' : 'Finalizar (Stock + Kardex)'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <CommandDialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <CommandInput placeholder="Buscar producto (min 2 letras)…" value={productQuery} onValueChange={setProductQuery} />
        <CommandList>
          <CommandEmpty>
            {productSearching ? 'Buscando…' : productQuery.trim().length < 2 ? 'Escribe al menos 2 letras.' : 'Sin resultados.'}
          </CommandEmpty>
          <CommandGroup heading="Productos">
            {productResults.map((p) => {
              const label = p.code ? `${p.name} (${p.code})` : p.name;
              return (
                <CommandItem
                  key={p.idProduct}
                  value={label}
                  onSelect={() => addProduct(p)}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{label}</div>
                      <div className="truncate text-xs text-muted-foreground">ID: {p.idProduct}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{p.price ?? 0}</div>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
