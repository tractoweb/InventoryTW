'use client';

import * as React from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

import { getWarehouses } from '@/actions/get-warehouses';
import { getDocumentTypes } from '@/actions/get-document-types';
import { searchProductsAction, type ProductSearchResult } from '@/actions/search-products';
import { createDocumentAction } from '@/actions/create-document';
import { finalizeDocumentAction } from '@/actions/finalize-document';
import { createCustomerAction } from '@/actions/create-customer';
import { createProductAction } from '@/actions/create-product';
import { getCountries, type CountryListItem } from '@/actions/get-countries';
import { searchCustomersAction, type CustomerSearchResult } from '@/actions/search-customers';
import { getProductGroups, type ProductGroup } from '@/actions/get-product-groups';
import { getTaxes, type Tax } from '@/actions/get-taxes';
import { getCurrencies, type CurrencyListItem } from '@/actions/get-currencies';

import {
  computeLiquidation,
  type LiquidationConfig,
  type LiquidationFreightRate,
  type LiquidationLineInput,
} from '@/lib/liquidation';

type SelectOption = { value: number; label: string };

type DraftItem = {
  productId: number;
  productLabel: string;
  quantity: number;
  totalCost: number;
  discountPercentage: number;
  marginPercentage: number;
  freightId: string;
  purchaseReference: string;
  warehouseReference: string;
};

function formatMoney(amount: number) {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function NewDocumentForm() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [finalizing, setFinalizing] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmFinalize, setConfirmFinalize] = React.useState(false);

  const [customers, setCustomers] = React.useState<SelectOption[]>([]);
  const [countries, setCountries] = React.useState<CountryListItem[]>([]);
  const [productGroups, setProductGroups] = React.useState<ProductGroup[]>([]);
  const [taxes, setTaxes] = React.useState<Tax[]>([]);
  const [currencies, setCurrencies] = React.useState<CurrencyListItem[]>([]);
  const [warehouses, setWarehousesState] = React.useState<SelectOption[]>([]);
  const [documentTypes, setDocumentTypesState] = React.useState<SelectOption[]>([]);

  const [warehouseId, setWarehouseId] = React.useState<number | ''>('');
  const [documentTypeId, setDocumentTypeId] = React.useState<number | ''>('');
  const [customerId, setCustomerId] = React.useState<number | ''>('');

  // Supplier search dialog
  const [supplierDialogOpen, setSupplierDialogOpen] = React.useState(false);
  const [supplierQuery, setSupplierQuery] = React.useState('');
  const [supplierResults, setSupplierResults] = React.useState<CustomerSearchResult[]>([]);
  const [supplierSearching, setSupplierSearching] = React.useState(false);

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

  // Liquidación: configuración global (basada en la calculadora)
  const [ivaPercentage, setIvaPercentage] = React.useState<number | ''>(19);
  const [ivaIncludedInCost, setIvaIncludedInCost] = React.useState(false);
  const [discountsEnabled, setDiscountsEnabled] = React.useState(true);
  const [globalMargin, setGlobalMargin] = React.useState<number | ''>(40);

  const [useMultipleFreights, setUseMultipleFreights] = React.useState(false);
  const [freightRates, setFreightRates] = React.useState<LiquidationFreightRate[]>([
    { id: '1', name: 'Flete 1', cost: 0 },
  ]);

  // Create supplier/product dialogs
  const [createSupplierOpen, setCreateSupplierOpen] = React.useState(false);
  const [newSupplierName, setNewSupplierName] = React.useState('');
  const [newSupplierTaxNumber, setNewSupplierTaxNumber] = React.useState('');
  const [newSupplierCode, setNewSupplierCode] = React.useState('');
  const [newSupplierAddress, setNewSupplierAddress] = React.useState('');
  const [newSupplierPostalCode, setNewSupplierPostalCode] = React.useState('');
  const [newSupplierCity, setNewSupplierCity] = React.useState('');
  const [newSupplierCountryId, setNewSupplierCountryId] = React.useState<number | ''>('');
  const [newSupplierEmail, setNewSupplierEmail] = React.useState('');
  const [newSupplierPhoneNumber, setNewSupplierPhoneNumber] = React.useState('');
  const [newSupplierDueDatePeriod, setNewSupplierDueDatePeriod] = React.useState<number | ''>('');
  const [newSupplierIsTaxExempt, setNewSupplierIsTaxExempt] = React.useState(false);
  const [newSupplierIsCustomer, setNewSupplierIsCustomer] = React.useState(false);

  const [createProductOpen, setCreateProductOpen] = React.useState(false);
  const [newProductName, setNewProductName] = React.useState('');
  const [newProductCode, setNewProductCode] = React.useState('');
  const [newProductCost, setNewProductCost] = React.useState<number | ''>('');
  const [newProductPrice, setNewProductPrice] = React.useState<number | ''>('');
  const [newProductGroupId, setNewProductGroupId] = React.useState<number | ''>('');
  const [newProductCurrencyId, setNewProductCurrencyId] = React.useState<number | ''>('');
  const [newProductMeasurementUnit, setNewProductMeasurementUnit] = React.useState('');
  const [newProductPlu, setNewProductPlu] = React.useState<number | ''>('');
  const [newProductMarkup, setNewProductMarkup] = React.useState<number | ''>('');
  const [newProductDescription, setNewProductDescription] = React.useState('');
  const [newProductIsEnabled, setNewProductIsEnabled] = React.useState(true);
  const [newProductIsService, setNewProductIsService] = React.useState(false);
  const [newProductIsTaxInclusivePrice, setNewProductIsTaxInclusivePrice] = React.useState(true);
  const [newProductIsPriceChangeAllowed, setNewProductIsPriceChangeAllowed] = React.useState(false);
  const [newProductIsUsingDefaultQuantity, setNewProductIsUsingDefaultQuantity] = React.useState(true);
  const [newProductBarcodesText, setNewProductBarcodesText] = React.useState('');
  const [newProductTaxIds, setNewProductTaxIds] = React.useState<number[]>([]);

  // Product search dialog
  const [productDialogOpen, setProductDialogOpen] = React.useState(false);
  const [productQuery, setProductQuery] = React.useState('');
  const [productResults, setProductResults] = React.useState<ProductSearchResult[]>([]);
  const [productSearching, setProductSearching] = React.useState(false);
  const [onlySupplierProducts, setOnlySupplierProducts] = React.useState(false);

  const liquidationConfig: LiquidationConfig = React.useMemo(
    () => ({
      ivaPercentage: typeof ivaPercentage === 'number' ? ivaPercentage : 0,
      ivaIncludedInCost,
      discountsEnabled,
      useMultipleFreights,
      freightRates,
    }),
    [discountsEnabled, freightRates, ivaIncludedInCost, ivaPercentage, useMultipleFreights]
  );

  const liquidation = React.useMemo(() => {
    const lines: LiquidationLineInput[] = items.map((it, idx) => ({
      id: `${it.productId}-${idx}`,
      productId: it.productId,
      name: it.productLabel,
      purchaseReference: it.purchaseReference,
      warehouseReference: it.warehouseReference,
      quantity: Number(it.quantity) || 0,
      totalCost: Number(it.totalCost) || 0,
      discountPercentage: Number(it.discountPercentage) || 0,
      marginPercentage: Number(it.marginPercentage) || 0,
      freightId: it.freightId,
    }));
    return computeLiquidation(liquidationConfig, lines);
  }, [items, liquidationConfig]);

  React.useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        const [countriesRes, suppliersRes, wh, dt, pgRes, taxesRes, curRes] = await Promise.all([
          getCountries(),
          searchCustomersAction('', 50, { onlyEnabled: true, onlySuppliers: true }),
          getWarehouses({ onlyEnabled: true }),
          getDocumentTypes(),
          getProductGroups(),
          getTaxes(),
          getCurrencies(),
        ]);

        setCountries(countriesRes.data ?? []);
        setProductGroups(pgRes.data ?? []);
        setTaxes(taxesRes.data ?? []);
        setCurrencies(curRes.data ?? []);

        // Default currency to COP if available.
        const cop = (curRes.data ?? []).find((c) => String(c?.code ?? '').toUpperCase() === 'COP');
        if (cop && newProductCurrencyId === '') setNewProductCurrencyId(Number(cop.idCurrency));
        setSupplierResults(suppliersRes.data ?? []);
        setCustomers((suppliersRes.data ?? []).map((c) => ({ value: Number(c.idCustomer), label: String(c.name) })));

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
      if (!supplierDialogOpen) return;

      const q = supplierQuery.trim();
      setSupplierSearching(true);
      const res = await searchCustomersAction(q, 50, { onlyEnabled: true, onlySuppliers: true });
      setSupplierResults(res.data ?? []);
      setSupplierSearching(false);
    }, 200);

    return () => clearTimeout(handle);
  }, [supplierDialogOpen, supplierQuery]);

  React.useEffect(() => {
    const handle = setTimeout(async () => {
      const q = productQuery.trim();
      if (!productDialogOpen) return;
      setProductSearching(true);
      const res = await searchProductsAction(q, 30, {
        supplierId: typeof customerId === 'number' ? customerId : undefined,
        onlySupplierProducts: onlySupplierProducts && typeof customerId === 'number',
      });
      setProductResults(res.data ?? []);
      setProductSearching(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [productQuery, productDialogOpen, customerId, onlySupplierProducts]);

  function addProduct(p: ProductSearchResult) {
    const label = p.code ? `${p.name} (${p.code})` : p.name;
    const unitCostSeed = Number(p.cost ?? p.price ?? 0);
    const marginSeed = typeof globalMargin === 'number' ? globalMargin : 30;
    setItems((prev) => [
      ...prev,
      {
        productId: p.idProduct,
        productLabel: label,
        quantity: 1,
        totalCost: unitCostSeed,
        discountPercentage: 0,
        marginPercentage: marginSeed,
        freightId: freightRates[0]?.id ?? '1',
        purchaseReference: p.code ? String(p.code) : '',
        warehouseReference: '',
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

  function updateFreightRate(id: string, patch: Partial<LiquidationFreightRate>) {
    setFreightRates((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function addFreightRate() {
    setFreightRates((prev) => {
      const nextId = String(prev.length + 1);
      return [...prev, { id: nextId, name: `Flete ${nextId}`, cost: 0 }];
    });
  }

  function removeFreightRate(id: string) {
    setFreightRates((prev) => {
      const next = prev.filter((f) => f.id !== id);
      return next.length > 0 ? next : [{ id: '1', name: 'Flete 1', cost: 0 }];
    });
    setItems((prev) => {
      const fallback = freightRates.find((f) => f.id !== id)?.id ?? '1';
      return prev.map((it) => (it.freightId === id ? { ...it, freightId: fallback } : it));
    });
  }

  async function handleCreateSupplier() {
    const name = newSupplierName.trim();
    if (!name) return;
    try {
      const res = await createCustomerAction({
        name,
        code: newSupplierCode || undefined,
        taxNumber: newSupplierTaxNumber || undefined,
        address: newSupplierAddress || undefined,
        postalCode: newSupplierPostalCode || undefined,
        city: newSupplierCity || undefined,
        countryId: typeof newSupplierCountryId === 'number' ? newSupplierCountryId : undefined,
        email: newSupplierEmail || undefined,
        phoneNumber: newSupplierPhoneNumber || undefined,
        dueDatePeriod: typeof newSupplierDueDatePeriod === 'number' ? newSupplierDueDatePeriod : undefined,
        isTaxExempt: Boolean(newSupplierIsTaxExempt),
        isEnabled: true,
        isSupplier: true,
        isCustomer: Boolean(newSupplierIsCustomer),
      });
      if (!res.success || !res.idCustomer) throw new Error(res.error || 'No se pudo crear el proveedor');

      const suppliersRes = await searchCustomersAction('', 50, { onlyEnabled: true, onlySuppliers: true });
      setSupplierResults(suppliersRes.data ?? []);
      setCustomers((suppliersRes.data ?? []).map((c) => ({ value: Number(c.idCustomer), label: String(c.name) })));
      setCustomerId(res.idCustomer);
      setCreateSupplierOpen(false);
      setNewSupplierName('');
      setNewSupplierTaxNumber('');
      setNewSupplierCode('');
      setNewSupplierAddress('');
      setNewSupplierPostalCode('');
      setNewSupplierCity('');
      setNewSupplierCountryId('');
      setNewSupplierEmail('');
      setNewSupplierPhoneNumber('');
      setNewSupplierDueDatePeriod('');
      setNewSupplierIsTaxExempt(false);
      setNewSupplierIsCustomer(false);
      toast({ title: 'Proveedor creado', description: `ID ${res.idCustomer}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudo crear el proveedor' });
    }
  }

  async function handleCreateProduct() {
    const name = newProductName.trim();
    if (!name) return;
    try {
      const barcodes = newProductBarcodesText
        .split(/\r?\n|,|;|\t/g)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await createProductAction({
        name,
        code: newProductCode || undefined,
        cost: typeof newProductCost === 'number' ? newProductCost : undefined,
        price: typeof newProductPrice === 'number' ? newProductPrice : undefined,
        productGroupId: typeof newProductGroupId === 'number' ? newProductGroupId : undefined,
        currencyId: typeof newProductCurrencyId === 'number' ? newProductCurrencyId : undefined,
        measurementUnit: newProductMeasurementUnit || undefined,
        plu: typeof newProductPlu === 'number' ? newProductPlu : undefined,
        description: newProductDescription || undefined,
        markup: typeof newProductMarkup === 'number' ? newProductMarkup : undefined,
        isPriceChangeAllowed: Boolean(newProductIsPriceChangeAllowed),
        isUsingDefaultQuantity: Boolean(newProductIsUsingDefaultQuantity),
        isEnabled: Boolean(newProductIsEnabled),
        isService: Boolean(newProductIsService),
        isTaxInclusivePrice: Boolean(newProductIsTaxInclusivePrice),
        barcodes: barcodes.length ? barcodes : undefined,
        taxIds: newProductTaxIds.length ? newProductTaxIds : undefined,
      });
      if (!res.success || !res.idProduct) throw new Error(res.error || 'No se pudo crear el producto');

      addProduct({
        idProduct: res.idProduct,
        name,
        code: newProductCode || undefined,
        cost: typeof newProductCost === 'number' ? newProductCost : 0,
        price: typeof newProductPrice === 'number' ? newProductPrice : 0,
      });

      setCreateProductOpen(false);
      setNewProductName('');
      setNewProductCode('');
      setNewProductCost('');
      setNewProductPrice('');
      setNewProductGroupId('');
      setNewProductMeasurementUnit('');
      setNewProductPlu('');
      setNewProductMarkup('');
      setNewProductDescription('');
      setNewProductIsEnabled(true);
      setNewProductIsService(false);
      setNewProductIsTaxInclusivePrice(true);
      setNewProductIsPriceChangeAllowed(false);
      setNewProductIsUsingDefaultQuantity(true);
      setNewProductBarcodesText('');
      setNewProductTaxIds([]);
      toast({ title: 'Producto creado', description: `ID ${res.idProduct}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudo crear el producto' });
    }
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
      const liqLines = liquidation.lines;

      const liquidationSnapshot = {
        version: 1,
        config: {
          ivaPercentage: typeof ivaPercentage === 'number' ? ivaPercentage : 0,
          ivaIncludedInCost,
          discountsEnabled,
          useMultipleFreights,
          freightRates,
        },
        lineInputs: items.map((it, idx) => ({
          id: String(idx + 1),
          productId: it.productId,
          name: it.productLabel,
          purchaseReference: it.purchaseReference,
          warehouseReference: it.warehouseReference,
          quantity: it.quantity,
          totalCost: it.totalCost,
          discountPercentage: it.discountPercentage,
          marginPercentage: it.marginPercentage,
          freightId: it.freightId,
        })),
        totals: liquidation.totals,
      };

      const created = await createDocumentAction({
        userId: 1,
        customerId: customerId ? Number(customerId) : undefined,
        warehouseId: Number(warehouseId),
        documentTypeId: Number(documentTypeId),
        date,
        referenceDocumentNumber: referenceDocumentNumber || undefined,
        note: note || undefined,
        internalNote: JSON.stringify({
          liquidation: liquidationSnapshot,
        }),
        items: items.map((it, idx) => ({
          productId: it.productId,
          quantity: it.quantity,
          price: liqLines[idx]?.unitFinalCost ?? 0,
          productCost: liqLines[idx]?.unitFinalCost ?? 0,
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

  function requestSave(finalize: boolean) {
    setConfirmFinalize(finalize);
    setConfirmOpen(true);
  }

  function selectedSupplierLabel() {
    if (typeof customerId !== 'number') return '(Opcional)';
    const found = customers.find((c) => c.value === customerId);
    return found?.label ?? `ID ${customerId}`;
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
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 justify-between" onClick={() => setSupplierDialogOpen(true)} disabled={loading}>
                <span className="truncate">{selectedSupplierLabel()}</span>
                <span className="text-muted-foreground">▾</span>
              </Button>
              <Button type="button" variant="outline" onClick={() => setCreateSupplierOpen(true)} disabled={loading}>
                Crear
              </Button>
            </div>
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
        <CardHeader>
          <CardTitle>Configuración Global</CardTitle>
          <CardDescription>Parámetros que afectan a toda la liquidación.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>IVA (%)</Label>
            <Input
              type="number"
              value={ivaPercentage}
              onChange={(e) => setIvaPercentage(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <div className="flex items-center gap-2">
              <Checkbox checked={ivaIncludedInCost} onCheckedChange={(v) => setIvaIncludedInCost(Boolean(v))} />
              <span className="text-xs text-muted-foreground">IVA ya incluido en costo</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Margen global (%)</Label>
            <Input
              type="number"
              value={globalMargin}
              onChange={(e) => setGlobalMargin(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <div className="text-xs text-muted-foreground">Se usa como valor inicial por item.</div>
          </div>

          <div className="grid gap-2">
            <Label>Opciones</Label>
            <div className="flex items-center gap-2">
              <Checkbox checked={discountsEnabled} onCheckedChange={(v) => setDiscountsEnabled(Boolean(v))} />
              <span className="text-xs text-muted-foreground">Aplicar descuentos individuales</span>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={useMultipleFreights} onCheckedChange={(v) => setUseMultipleFreights(Boolean(v))} />
              <span className="text-xs text-muted-foreground">Usar varios fletes diferentes</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fletes</CardTitle>
          <CardDescription>Configura el costo del flete que se distribuirá entre los productos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {freightRates.map((f) => (
            <div key={f.id} className="grid grid-cols-1 gap-2 md:grid-cols-6">
              <div className="md:col-span-3">
                <Label>Nombre</Label>
                <Input value={f.name} onChange={(e) => updateFreightRate(f.id, { name: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Costo</Label>
                <Input
                  type="number"
                  value={String(f.cost)}
                  onChange={(e) => updateFreightRate(f.id, { cost: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="md:col-span-1 flex items-end">
                <Button type="button" variant="outline" className="w-full" onClick={() => removeFreightRate(f.id)} disabled={freightRates.length <= 1}>
                  Quitar
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button type="button" variant="outline" onClick={addFreightRate} disabled={!useMultipleFreights}>
              Agregar flete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Productos</CardTitle>
            <CardDescription>Agrega productos y liquida costos (IVA, flete, descuento, margen).</CardDescription>
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
            <div className="w-full overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">Nombre</TableHead>
                    <TableHead className="min-w-[140px]">Ref. Compra</TableHead>
                    <TableHead className="min-w-[140px]">Ref. Bodega</TableHead>
                    <TableHead className="min-w-[90px] text-right">Cant.</TableHead>
                    <TableHead className="min-w-[140px] text-right">Costo Total</TableHead>
                    <TableHead className="min-w-[90px] text-right">Desc. %</TableHead>
                    <TableHead className="min-w-[120px] text-right">Unit. Base</TableHead>
                    <TableHead className="min-w-[120px] text-right">- Desc.</TableHead>
                    <TableHead className="min-w-[120px] text-right">+ IVA</TableHead>
                    <TableHead className="min-w-[120px] text-right">+ Flete</TableHead>
                    <TableHead className="min-w-[160px]">Flete asignado</TableHead>
                    <TableHead className="min-w-[140px] text-right">Unit. Final</TableHead>
                    <TableHead className="min-w-[120px] text-right">Margen %</TableHead>
                    <TableHead className="min-w-[140px] text-right">Venta Unit.</TableHead>
                    <TableHead className="min-w-[140px] text-right">Total Final</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => {
                    const li = liquidation.lines[idx];
                    return (
                      <TableRow key={`${it.productId}-${idx}`}>
                        <TableCell className="font-medium">{it.productLabel}</TableCell>
                        <TableCell>
                          <Input value={it.purchaseReference} onChange={(e) => updateItem(idx, { purchaseReference: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Input value={it.warehouseReference} onChange={(e) => updateItem(idx, { warehouseReference: e.target.value })} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            className="w-24 text-right"
                            value={String(it.quantity)}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            className="w-32 text-right"
                            value={String(it.totalCost)}
                            onChange={(e) => updateItem(idx, { totalCost: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            className="w-24 text-right"
                            value={String(it.discountPercentage)}
                            onChange={(e) => updateItem(idx, { discountPercentage: Number(e.target.value) || 0 })}
                            disabled={!discountsEnabled}
                          />
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(li?.unitCost ?? 0)}</TableCell>
                        <TableCell className="text-right">{formatMoney(li?.unitDiscount ?? 0)}</TableCell>
                        <TableCell className="text-right">{formatMoney(li?.unitIVA ?? 0)}</TableCell>
                        <TableCell className="text-right">{formatMoney(li?.unitFreight ?? 0)}</TableCell>
                        <TableCell>
                          <select
                            className="h-9 w-40 rounded-md border bg-background px-2 text-sm"
                            value={it.freightId}
                            onChange={(e) => updateItem(idx, { freightId: e.target.value })}
                            disabled={!useMultipleFreights}
                            title={useMultipleFreights ? 'Selecciona el flete para este producto' : 'Activa "Usar varios fletes" para asignar'}
                          >
                            {freightRates.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(li?.unitFinalCost ?? 0)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            className="w-24 text-right"
                            value={String(it.marginPercentage)}
                            onChange={(e) => updateItem(idx, { marginPercentage: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(li?.unitSalePrice ?? 0)}</TableCell>
                        <TableCell className="text-right">{formatMoney(li?.totalFinalCost ?? 0)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                            Quitar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-end gap-6 pt-2">
            <div className="text-sm text-muted-foreground">Total (costo final)</div>
            <div className="text-lg font-semibold">{formatMoney(liquidation.totals.totalFinalCost)}</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => requestSave(false)} disabled={saving || finalizing || loading}>
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            <Button onClick={() => requestSave(true)} disabled={saving || finalizing || loading}>
              {finalizing ? 'Finalizando…' : 'Finalizar (Stock + Kardex)'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmFinalize ? 'Confirmar finalización' : 'Confirmar guardado'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmFinalize
                ? 'Esta acción impacta Stock y genera Kardex. Verifica cantidades y costos antes de continuar.'
                : 'Se guardará como borrador (no afecta Stock ni Kardex).'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="text-muted-foreground">Items</div>
              <div className="font-medium">{items.length}</div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-muted-foreground">Costo final</div>
              <div className="font-medium">{formatMoney(liquidation.totals.totalFinalCost)}</div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-muted-foreground">IVA</div>
              <div className="font-medium">{formatMoney(liquidation.totals.totalIVA)}</div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-muted-foreground">Flete</div>
              <div className="font-medium">{formatMoney(liquidation.totals.totalFreight)}</div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving || finalizing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                handleSave(confirmFinalize);
              }}
              disabled={saving || finalizing || loading}
            >
              {confirmFinalize ? 'Finalizar' : 'Guardar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Resumen financiero</CardTitle>
          <CardDescription>Basado en la liquidación (costo, IVA, fletes, margen).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="text-sm">
            <div className="text-muted-foreground">Compra (Costo total)</div>
            <div className="font-semibold">{formatMoney(liquidation.totals.totalPurchaseCost)}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">Descuento total</div>
            <div className="font-semibold">{formatMoney(liquidation.totals.totalDiscount)}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">IVA total</div>
            <div className="font-semibold">{formatMoney(liquidation.totals.totalIVA)}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">Flete total</div>
            <div className="font-semibold">{formatMoney(liquidation.totals.totalFreight)}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">Costo final</div>
            <div className="font-semibold">{formatMoney(liquidation.totals.totalFinalCost)}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">Venta estimada</div>
            <div className="font-semibold">{formatMoney(liquidation.totals.totalSalePrice)}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">Ganancia estimada</div>
            <div className="font-semibold">{formatMoney(liquidation.totals.totalProfit)}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">Margen ganancia</div>
            <div className="font-semibold">{liquidation.totals.profitMarginPercentage.toFixed(1)}%</div>
          </div>
        </CardContent>
      </Card>

      <CommandDialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <CommandInput placeholder="Buscar producto (min 2 letras)…" value={productQuery} onValueChange={setProductQuery} />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col gap-2">
              <div>
                {productSearching
                  ? 'Buscando…'
                  : 'No hay resultados. Prueba con referencia (código) o nombre.'}
              </div>
              {productQuery.trim().length >= 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewProductName(productQuery.trim());
                    setCreateProductOpen(true);
                  }}
                >
                  Crear producto: “{productQuery.trim()}”
                </Button>
              ) : null}
            </div>
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
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={onlySupplierProducts}
              onCheckedChange={(v) => setOnlySupplierProducts(Boolean(v))}
              disabled={typeof customerId !== 'number'}
            />
            <span className="text-xs text-muted-foreground">
              Filtrar por proveedor seleccionado
              {typeof customerId !== 'number' ? ' (selecciona un proveedor)' : ''}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">Si no escribes nada, muestra una lista base (o del proveedor).</div>
        </div>
      </CommandDialog>

      <CommandDialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <CommandInput placeholder="Buscar proveedor (nombre, código o NIT)…" value={supplierQuery} onValueChange={setSupplierQuery} />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col gap-2">
              <div>{supplierSearching ? 'Buscando…' : 'Sin resultados.'}</div>
              {supplierQuery.trim().length >= 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewSupplierName(supplierQuery.trim());
                    setCreateSupplierOpen(true);
                    setSupplierDialogOpen(false);
                  }}
                >
                  Crear proveedor: “{supplierQuery.trim()}”
                </Button>
              ) : null}
            </div>
          </CommandEmpty>
          <CommandGroup heading="Proveedores">
            <CommandItem
              value="(opcional)"
              onSelect={() => {
                setCustomerId('');
                setSupplierDialogOpen(false);
              }}
            >
              (Opcional)
            </CommandItem>
            {supplierResults.map((s) => (
              <CommandItem
                key={s.idCustomer}
                value={`${s.name} ${s.code ?? ''} ${s.taxNumber ?? ''}`}
                onSelect={() => {
                  setCustomerId(Number(s.idCustomer));
                  setSupplierDialogOpen(false);
                }}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.code ? `Código: ${s.code}` : null}
                    {s.code && s.taxNumber ? ' • ' : null}
                    {s.taxNumber ? `NIT: ${s.taxNumber}` : null}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Dialog open={createSupplierOpen} onOpenChange={setCreateSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear proveedor</DialogTitle>
            <DialogDescription>Agrega un proveedor rápido sin salir del documento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Código</Label>
                <Input value={newSupplierCode} onChange={(e) => setNewSupplierCode(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>NIT / Documento</Label>
                <Input value={newSupplierTaxNumber} onChange={(e) => setNewSupplierTaxNumber(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Dirección</Label>
              <Input value={newSupplierAddress} onChange={(e) => setNewSupplierAddress(e.target.value)} />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="grid gap-2 md:col-span-2">
                <Label>Ciudad</Label>
                <Input value={newSupplierCity} onChange={(e) => setNewSupplierCity(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Código postal</Label>
                <Input value={newSupplierPostalCode} onChange={(e) => setNewSupplierPostalCode(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>País</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={newSupplierCountryId}
                onChange={(e) => setNewSupplierCountryId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">(Opcional)</option>
                {countries.map((c) => (
                  <option key={c.idCountry} value={c.idCountry}>
                    {c.name}{c.code ? ` (${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={newSupplierEmail} onChange={(e) => setNewSupplierEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={newSupplierPhoneNumber} onChange={(e) => setNewSupplierPhoneNumber(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Plazo vencimiento (días)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newSupplierDueDatePeriod}
                  onChange={(e) => setNewSupplierDueDatePeriod(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={newSupplierIsTaxExempt} onCheckedChange={(v) => setNewSupplierIsTaxExempt(Boolean(v))} />
                  <span className="text-xs text-muted-foreground">Exento de IVA</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={newSupplierIsCustomer} onCheckedChange={(v) => setNewSupplierIsCustomer(Boolean(v))} />
                  <span className="text-xs text-muted-foreground">También es cliente</span>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">Se guardará con `isSupplier=true` y `isEnabled=true`.</div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateSupplierOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreateSupplier}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createProductOpen} onOpenChange={setCreateProductOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear producto</DialogTitle>
            <DialogDescription>Agrega un producto rápido y selecciónalo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 max-h-[70vh] overflow-auto pr-1">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Código / Referencia</Label>
              <Input value={newProductCode} onChange={(e) => setNewProductCode(e.target.value)} />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Grupo de producto</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={newProductGroupId}
                  onChange={(e) => setNewProductGroupId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">(Sin grupo)</option>
                  {productGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Moneda</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={newProductCurrencyId}
                  onChange={(e) => setNewProductCurrencyId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">(Sin moneda)</option>
                  {currencies.map((c) => (
                    <option key={c.idCurrency} value={c.idCurrency}>
                      {c.code ? `${c.name} (${c.code})` : c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Unidad de medida</Label>
                <Input
                  value={newProductMeasurementUnit}
                  onChange={(e) => setNewProductMeasurementUnit(e.target.value)}
                  placeholder="Ej: UND"
                />
              </div>
              <div className="grid gap-2">
                <Label>PLU</Label>
                <Input
                  type="number"
                  value={newProductPlu}
                  onChange={(e) => setNewProductPlu(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Markup (%)</Label>
                <Input
                  type="number"
                  value={newProductMarkup}
                  onChange={(e) => setNewProductMarkup(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Costo</Label>
                <Input type="number" value={newProductCost} onChange={(e) => setNewProductCost(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div className="grid gap-2">
                <Label>Precio venta</Label>
                <Input type="number" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea value={newProductDescription} onChange={(e) => setNewProductDescription(e.target.value)} placeholder="(Opcional)" />
            </div>

            <div className="grid gap-2">
              <Label>Códigos de barras (uno por línea o separados por coma)</Label>
              <Textarea
                value={newProductBarcodesText}
                onChange={(e) => setNewProductBarcodesText(e.target.value)}
                placeholder="7701234567890\n7700000000000"
              />
            </div>

            <div className="grid gap-2">
              <Label>Impuestos</Label>
              {taxes.length === 0 ? (
                <div className="text-xs text-muted-foreground">No hay impuestos cargados.</div>
              ) : (
                <div className="max-h-32 overflow-auto rounded-md border p-2">
                  <div className="grid gap-2 md:grid-cols-2">
                    {taxes.map((t) => {
                      const checked = newProductTaxIds.includes(t.id);
                      return (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const on = Boolean(v);
                              setNewProductTaxIds((prev) =>
                                on ? Array.from(new Set([...prev, t.id])) : prev.filter((x) => x !== t.id)
                              );
                            }}
                          />
                          <span>
                            {t.name} ({Number(t.rate ?? 0)}%)
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={newProductIsEnabled} onCheckedChange={(v) => setNewProductIsEnabled(Boolean(v))} />
                  Activo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={newProductIsService} onCheckedChange={(v) => setNewProductIsService(Boolean(v))} />
                  Es servicio
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={newProductIsTaxInclusivePrice}
                    onCheckedChange={(v) => setNewProductIsTaxInclusivePrice(Boolean(v))}
                  />
                  Precio incluye impuestos
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={newProductIsPriceChangeAllowed}
                    onCheckedChange={(v) => setNewProductIsPriceChangeAllowed(Boolean(v))}
                  />
                  Permitir cambiar precio
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={newProductIsUsingDefaultQuantity}
                    onCheckedChange={(v) => setNewProductIsUsingDefaultQuantity(Boolean(v))}
                  />
                  Usar cantidad por defecto
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateProductOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreateProduct}>
              Crear y agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
