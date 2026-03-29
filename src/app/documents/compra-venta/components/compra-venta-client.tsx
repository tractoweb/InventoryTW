'use client';

import * as React from 'react';
import Link from 'next/link';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';

import { getWarehouses } from '@/actions/get-warehouses';
import { searchCustomersAction, type CustomerSearchResult } from '@/actions/search-customers';
import { searchClientsAction, type ClientSearchResult } from '@/actions/search-clients';
import { searchProductsAction, type ProductSearchResult } from '@/actions/search-products';
import { ensurePassThroughDocumentTypeAction } from '@/actions/ensure-pass-through-document-type';
import { createDocumentAction } from '@/actions/create-document';
import { finalizeDocumentAction } from '@/actions/finalize-document';
import { parseDecimalLooseOptional } from '@/lib/parse-decimal';

type SelectOption = { value: number; label: string };
type OperationKind = 'purchase' | 'sale';

type DraftItem = {
  lineId: string;
  productId: number;
  label: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

function newLineId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function todayYmd(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatMoney(value: unknown): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function toDecimalText(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '';
  return String(n).replace('.', ',');
}

export function CompraVentaClientPage({ userId }: { userId: number }) {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [warehouseOptions, setWarehouseOptions] = React.useState<SelectOption[]>([]);
  const [warehouseId, setWarehouseId] = React.useState<number | ''>('');

  const [operationKind, setOperationKind] = React.useState<OperationKind>('purchase');
  const [documentTypeIds, setDocumentTypeIds] = React.useState<{ purchase: number | null; sale: number | null }>({
    purchase: null,
    sale: null,
  });

  const [date, setDate] = React.useState<string>(todayYmd());
  const [referenceDocumentNumber, setReferenceDocumentNumber] = React.useState('');
  const [note, setNote] = React.useState('');

  const [supplierQuery, setSupplierQuery] = React.useState('');
  const debouncedSupplierQuery = useDebounce(supplierQuery, 300);
  const [supplierResults, setSupplierResults] = React.useState<CustomerSearchResult[]>([]);
  const [selectedSupplier, setSelectedSupplier] = React.useState<CustomerSearchResult | null>(null);

  const [clientQuery, setClientQuery] = React.useState('');
  const debouncedClientQuery = useDebounce(clientQuery, 300);
  const [clientResults, setClientResults] = React.useState<ClientSearchResult[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<ClientSearchResult | null>(null);
  const [manualClientName, setManualClientName] = React.useState('');

  const [productDialogOpen, setProductDialogOpen] = React.useState(false);
  const [productQuery, setProductQuery] = React.useState('');
  const debouncedProductQuery = useDebounce(productQuery, 250);
  const [productResults, setProductResults] = React.useState<ProductSearchResult[]>([]);
  const [items, setItems] = React.useState<DraftItem[]>([]);

  const [resultOpen, setResultOpen] = React.useState(false);
  const [resultDocumentId, setResultDocumentId] = React.useState<number | null>(null);
  const [resultDocumentNumber, setResultDocumentNumber] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        const wh = await getWarehouses({ onlyEnabled: true });
        const mapped = (wh.data ?? []).map((w: any) => ({ value: Number(w.idWarehouse), label: String(w.name) }));
        setWarehouseOptions(mapped);
        if (mapped.length > 0) setWarehouseId(mapped[0].value);
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudo cargar almacenes' });
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, [toast]);

  React.useEffect(() => {
    async function ensureTypes() {
      if (!(Number(warehouseId) > 0)) return;
      try {
        const [purchaseRes, saleRes] = await Promise.all([
          ensurePassThroughDocumentTypeAction({ warehouseId: Number(warehouseId), kind: 'purchase' }),
          ensurePassThroughDocumentTypeAction({ warehouseId: Number(warehouseId), kind: 'sale' }),
        ]);

        if (!purchaseRes.success || !purchaseRes.documentTypeId) {
          throw new Error(purchaseRes.error ?? 'No se pudo resolver tipo de compra sin inventario');
        }
        if (!saleRes.success || !saleRes.documentTypeId) {
          throw new Error(saleRes.error ?? 'No se pudo resolver tipo de venta sin inventario');
        }

        setDocumentTypeIds({
          purchase: Number(purchaseRes.documentTypeId),
          sale: Number(saleRes.documentTypeId),
        });
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudieron preparar los tipos de documento' });
      }
    }

    ensureTypes();
  }, [warehouseId, toast]);

  React.useEffect(() => {
    if (operationKind !== 'purchase') return;
    let active = true;

    searchCustomersAction(debouncedSupplierQuery, 20, { onlyEnabled: true, onlySuppliers: true })
      .then((res) => {
        if (!active) return;
        setSupplierResults(res.data ?? []);
      })
      .catch(() => {
        if (!active) return;
        setSupplierResults([]);
      });

    return () => {
      active = false;
    };
  }, [debouncedSupplierQuery, operationKind]);

  React.useEffect(() => {
    if (operationKind !== 'sale') return;
    let active = true;

    searchClientsAction(debouncedClientQuery, 20, { onlyEnabled: true })
      .then((res) => {
        if (!active) return;
        setClientResults(res.data ?? []);
      })
      .catch(() => {
        if (!active) return;
        setClientResults([]);
      });

    return () => {
      active = false;
    };
  }, [debouncedClientQuery, operationKind]);

  React.useEffect(() => {
    if (!productDialogOpen) return;
    let active = true;

    searchProductsAction(debouncedProductQuery, 40)
      .then((res) => {
        if (!active) return;
        setProductResults(res.data ?? []);
      })
      .catch(() => {
        if (!active) return;
        setProductResults([]);
      });

    return () => {
      active = false;
    };
  }, [debouncedProductQuery, productDialogOpen]);

  const totals = React.useMemo(() => {
    const subtotal = items.reduce((acc, it) => {
      return acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
    }, 0);

    return { subtotal };
  }, [items]);

  function addProduct(p: ProductSearchResult) {
    const label = p.code ? `${p.name} (${p.code})` : p.name;

    setItems((prev) => [
      ...prev,
      {
        lineId: newLineId(),
        productId: Number(p.idProduct),
        label,
        quantity: 1,
        unitPrice: Number(p.price ?? p.cost ?? 0) || 0,
        unitCost: Number(p.cost ?? 0) || 0,
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

  async function handleSave() {
    if (saving) return;

    try {
      setSaving(true);

      if (!(Number(warehouseId) > 0)) {
        throw new Error('Selecciona almacén');
      }
      if (!items.length) {
        throw new Error('Agrega al menos un producto');
      }

      const documentTypeId = operationKind === 'purchase' ? documentTypeIds.purchase : documentTypeIds.sale;
      if (!(Number(documentTypeId) > 0)) {
        throw new Error('No se encontró tipo de documento para esta operación');
      }

      const clientName = selectedClient?.name?.trim() || manualClientName.trim();
      if (operationKind === 'sale' && !clientName) {
        throw new Error('Para venta, selecciona un cliente o escribe un nombre');
      }

      const internalNote = JSON.stringify({
        source: 'COMPRAVENTA',
        kind: operationKind === 'purchase' ? 'PurchaseNoStock' : 'SaleNoStock',
        version: 1,
        noInventoryImpact: true,
        date,
        warehouseId: Number(warehouseId),
        thirdParty:
          operationKind === 'purchase'
            ? {
                supplierId: selectedSupplier ? Number(selectedSupplier.idCustomer) : null,
                supplierName: selectedSupplier?.name ?? null,
              }
            : {
                clientId: selectedClient ? Number(selectedClient.idClient) : null,
                clientName: clientName || 'Anónimo',
              },
      });

      const created = await createDocumentAction({
        userId: Number(userId),
        warehouseId: Number(warehouseId),
        documentTypeId: Number(documentTypeId),
        date,
        paidStatus: operationKind === 'sale' ? 2 : 0,
        customerId: operationKind === 'purchase' && selectedSupplier ? Number(selectedSupplier.idCustomer) : undefined,
        clientId: operationKind === 'sale' && selectedClient ? Number(selectedClient.idClient) : undefined,
        clientName: operationKind === 'sale' ? (clientName || 'Anónimo') : undefined,
        referenceDocumentNumber: referenceDocumentNumber.trim() || undefined,
        note: note.trim() || undefined,
        internalNote,
        items: items.map((it) => ({
          productId: Number(it.productId),
          quantity: Number(it.quantity) || 0,
          price: Number(it.unitPrice) || 0,
          productCost: Number(it.unitCost) || 0,
        })),
      });

      if (!created.success || !created.documentId) {
        throw new Error(created.error ?? 'No se pudo crear el documento');
      }

      const finalized = await finalizeDocumentAction({ documentId: Number(created.documentId) });
      if (!finalized.success) {
        throw new Error(finalized.error ?? 'El documento se creó, pero no se pudo finalizar');
      }

      setResultDocumentId(Number(created.documentId));
      setResultDocumentNumber(created.documentNumber ? String(created.documentNumber) : null);
      setResultOpen(true);

      setItems([]);
      setReferenceDocumentNumber('');
      setNote('');
      setSupplierQuery('');
      setSelectedSupplier(null);
      setClientQuery('');
      setSelectedClient(null);
      setManualClientName('');

      toast({ title: 'Documento registrado', description: 'Se guardó sin impacto de inventario.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudo guardar' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Documento finalizado
            </DialogTitle>
            <DialogDescription>
              Operación registrada sin impacto en inventario.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Documento</div>
              <div className="font-medium">{resultDocumentNumber ?? (resultDocumentId ? `#${resultDocumentId}` : '—')}</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResultOpen(false)}>
              Cerrar
            </Button>
            {resultDocumentId ? (
              <Button variant="outline" asChild>
                <Link href={`/documents?documentId=${encodeURIComponent(String(resultDocumentId))}`}>Abrir documento</Link>
              </Button>
            ) : null}
            {resultDocumentId ? (
              <Button asChild>
                <Link href={`/documents/${encodeURIComponent(String(resultDocumentId))}/pdf`}>Ver PDF</Link>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compra/Venta sin inventario</h1>
          <p className="text-muted-foreground">
            Registra operaciones de paso directo: compra y venta documental sin mover stock ni Kardex.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/documents">Volver a Documentos</Link>
        </Button>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Modo sin inventario</AlertTitle>
        <AlertDescription>
          Este módulo usa tipos documentales con dirección de stock neutral para no alterar existencias.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Encabezado</CardTitle>
          <CardDescription>Define tipo de operación, bodega, tercero y fecha.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Operación</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={operationKind}
              onChange={(e) => setOperationKind(e.target.value === 'sale' ? 'sale' : 'purchase')}
            >
              <option value="purchase">Compra sin inventario</option>
              <option value="sale">Venta sin inventario</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Almacén</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
              disabled={loading}
            >
              <option value="">Selecciona…</option>
              {warehouseOptions.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Número de referencia (opcional)</Label>
            <Input value={referenceDocumentNumber} onChange={(e) => setReferenceDocumentNumber(e.target.value)} />
          </div>

          {operationKind === 'purchase' ? (
            <div className="grid gap-2 md:col-span-2">
              <Label>Proveedor (opcional)</Label>
              <Input
                placeholder="Buscar proveedor por nombre, código o NIT"
                value={supplierQuery}
                onChange={(e) => setSupplierQuery(e.target.value)}
              />
              <div className="max-h-36 overflow-auto rounded-md border">
                {supplierResults.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">Sin resultados</div>
                ) : (
                  supplierResults.map((s) => (
                    <button
                      key={s.idCustomer}
                      type="button"
                      className="w-full border-b px-2 py-1 text-left text-sm last:border-b-0 hover:bg-muted"
                      onClick={() => {
                        setSelectedSupplier(s);
                        setSupplierQuery(s.name);
                      }}
                    >
                      {s.name}
                    </button>
                  ))
                )}
              </div>
              {selectedSupplier ? (
                <div className="text-xs text-muted-foreground">
                  Seleccionado: {selectedSupplier.name}{' '}
                  <button type="button" className="underline" onClick={() => setSelectedSupplier(null)}>
                    Limpiar
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-2 md:col-span-2">
              <Label>Cliente</Label>
              <Input
                placeholder="Buscar cliente por nombre, NIT, teléfono o email"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
              />
              <div className="max-h-36 overflow-auto rounded-md border">
                {clientResults.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">Sin resultados</div>
                ) : (
                  clientResults.map((c) => (
                    <button
                      key={c.idClient}
                      type="button"
                      className="w-full border-b px-2 py-1 text-left text-sm last:border-b-0 hover:bg-muted"
                      onClick={() => {
                        setSelectedClient(c);
                        setClientQuery(c.name);
                        setManualClientName(c.name);
                      }}
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
              <Input
                placeholder="Nombre manual (si no existe cliente)"
                value={manualClientName}
                onChange={(e) => setManualClientName(e.target.value)}
              />
            </div>
          )}

          <div className="grid gap-2 md:col-span-2">
            <Label>Nota</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Productos</CardTitle>
            <CardDescription>Agrega líneas con cantidades y precios de la operación.</CardDescription>
          </div>
          <Button variant="outline" onClick={() => setProductDialogOpen(true)}>
            Agregar producto
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay productos agregados.</div>
          ) : (
            <div className="w-full overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-[140px] text-right">Cantidad</TableHead>
                    <TableHead className="w-[180px] text-right">Precio Unitario</TableHead>
                    <TableHead className="w-[180px] text-right">Costo Unitario</TableHead>
                    <TableHead className="w-[160px] text-right">Total</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={it.lineId}>
                      <TableCell>{it.label}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="text-right"
                          value={toDecimalText(it.quantity)}
                          onChange={(e) => {
                            const n = parseDecimalLooseOptional(e.target.value);
                            updateItem(idx, { quantity: typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0 });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="text-right"
                          value={toDecimalText(it.unitPrice)}
                          onChange={(e) => {
                            const n = parseDecimalLooseOptional(e.target.value);
                            updateItem(idx, { unitPrice: typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0 });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="text-right"
                          value={toDecimalText(it.unitCost)}
                          onChange={(e) => {
                            const n = parseDecimalLooseOptional(e.target.value);
                            updateItem(idx, { unitCost: typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0 });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatMoney((it.quantity || 0) * (it.unitPrice || 0))}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                          Quitar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-end gap-6 pt-2">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-lg font-semibold">{formatMoney(totals.subtotal)}</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Guardando…' : 'Registrar y finalizar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <CommandDialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <CommandInput
          placeholder="Buscar producto por nombre, código o barra…"
          value={productQuery}
          onValueChange={setProductQuery}
        />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          <CommandGroup heading="Productos">
            {productResults.map((p) => {
              const label = p.code ? `${p.name} (${p.code})` : p.name;
              return (
                <CommandItem key={p.idProduct} value={label} onSelect={() => addProduct(p)}>
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{label}</div>
                      <div className="truncate text-xs text-muted-foreground">ID: {p.idProduct}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatMoney(p.price ?? 0)}</div>
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
