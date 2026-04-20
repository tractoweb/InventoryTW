'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useProductsCatalog } from '@/components/catalog/products-catalog-provider';

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
import { getSupplierProductIdsAction, searchProductsAction, type ProductSearchResult } from '@/actions/search-products';
import { createDocumentAction } from '@/actions/create-document';
import { finalizeDocumentAction } from '@/actions/finalize-document';
import { createCustomerAction } from '@/actions/create-customer';
import { getCountries, type CountryListItem } from '@/actions/get-countries';
import { searchCustomersAction, type CustomerSearchResult } from '@/actions/search-customers';
import { getProductGroups, type ProductGroup } from '@/actions/get-product-groups';
import { getCurrencies, type CurrencyListItem } from '@/actions/get-currencies';
import { createProductsFromDocumentLinesAction } from '@/actions/create-products-from-document-lines';
import { updateDocumentItemsAction } from '@/actions/update-document-items';
import { updateDocumentHeaderAction } from '@/actions/update-document-header';
import type { DocumentDetails } from '@/actions/get-document-details';
import { parseDecimalLooseOptional } from "@/lib/parse-decimal";

import {
  isStockDirectionIn,
  isStockDirectionOut,
} from '@/lib/amplify-config';

import {
  computeLiquidation,
  type LiquidationConfig,
  type LiquidationFreightRate,
  type LiquidationLineInput,
} from '@/lib/liquidation';

type SelectOption = { value: number; label: string };

type DocumentProductSearchResult = ProductSearchResult & {
  productGroupId?: number | null;
  productGroupName?: string | null;
  measurementUnit?: string | null;
  matchLabel?: string | null;
};

function normalizeLooseSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeCompactSearch(value: unknown): string {
  return normalizeLooseSearch(value).replace(/[^a-z0-9]+/g, '');
}

function tokenizeLooseSearch(value: unknown): string[] {
  return normalizeLooseSearch(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function rankCatalogProduct(
  product: DocumentProductSearchResult,
  rawQuery: string
): { score: number; matchLabel: string | null } | null {
  const query = String(rawQuery ?? '').trim();
  if (!query) return { score: 1, matchLabel: null };

  const queryLoose = normalizeLooseSearch(query);
  const queryCompact = normalizeCompactSearch(query);
  const tokens = tokenizeLooseSearch(query);
  const idText = String(product.idProduct ?? '');
  const nameLoose = normalizeLooseSearch(product.name);
  const codeLoose = normalizeLooseSearch(product.code);
  const nameCompact = normalizeCompactSearch(product.name);
  const codeCompact = normalizeCompactSearch(product.code);
  const groupLoose = normalizeLooseSearch(product.productGroupName);
  const haystack = [nameLoose, codeLoose, groupLoose, idText].join(' ');
  const haystackCompact = [nameCompact, codeCompact, idText].join(' ');

  let score = 0;
  let matchLabel: string | null = null;

  if (idText === query) {
    score += 160;
    matchLabel = 'ID exacto';
  }
  if (queryCompact && codeCompact === queryCompact) {
    score += 150;
    matchLabel = matchLabel ?? 'Referencia exacta';
  }
  if (queryLoose && nameLoose === queryLoose) {
    score += 140;
    matchLabel = matchLabel ?? 'Nombre exacto';
  }
  if (queryCompact && codeCompact.startsWith(queryCompact)) {
    score += 110;
    matchLabel = matchLabel ?? 'Referencia';
  }
  if (queryLoose && nameLoose.startsWith(queryLoose)) {
    score += 95;
    matchLabel = matchLabel ?? 'Nombre';
  }
  if (queryCompact && codeCompact.includes(queryCompact)) {
    score += 80;
    matchLabel = matchLabel ?? 'Referencia';
  }
  if (queryLoose && nameLoose.includes(queryLoose)) {
    score += 65;
    matchLabel = matchLabel ?? 'Nombre';
  }
  if (query.length >= 1 && idText.includes(query)) {
    score += 55;
    matchLabel = matchLabel ?? 'ID';
  }
  if (tokens.length > 0 && tokens.every((token) => haystack.includes(token) || haystackCompact.includes(token))) {
    score += 35;
    matchLabel = matchLabel ?? 'Coincidencia compuesta';
  }

  if (score <= 0) return null;
  return { score, matchLabel };
}

function toUserDecimalText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '';
  // Use comma for decimals to match es-CO input habits.
  return String(n).replace('.', ',');
}

function stockDirectionLabelEs(stockDirection: unknown): string {
  if (isStockDirectionIn(stockDirection)) return 'Entrada (compra)';
  if (isStockDirectionOut(stockDirection)) return 'Salida (venta)';
  return 'Sin movimiento';
}

type DraftProduct = {
  name: string;
  code?: string;
  productGroupId?: number;
  currencyId?: number;
  measurementUnit?: string;
  isService?: boolean;
  isEnabled?: boolean;
};

type DraftItem = {
  lineId: string;
  documentItemId?: number;
  productId: number | null;
  productLabel: string;
  draftProduct?: DraftProduct;
  quantity: number;
  totalCost: number;
  discountPercentage: number;
  marginPercentage: number;
  freightId: string;
  purchaseReference: string;
  warehouseReference: string;
  updateProductPrice: boolean;
  remove?: boolean;
};

interface NewDocumentFormProps {
  mode?: 'create' | 'edit';
  documentToEdit?: DocumentDetails;
}

function todayYmd(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parsePriceUpdateFlags(rawInternalNote: unknown): Set<number> {
  if (typeof rawInternalNote !== 'string') return new Set<number>();
  const trimmed = rawInternalNote.trim();
  if (!trimmed.startsWith('{')) return new Set<number>();

  try {
    const obj = JSON.parse(trimmed) as any;
    const flags = obj?.priceUpdate?.documentItemFlags;
    if (!flags || typeof flags !== 'object') return new Set<number>();

    const ids = Object.entries(flags)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([id]) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    return new Set<number>(ids);
  } catch {
    return new Set<number>();
  }
}

function buildInitialItems(documentToEdit?: DocumentDetails): DraftItem[] {
  if (!documentToEdit) return [];

  const lineInputs = documentToEdit.liquidation?.lineInputs ?? [];
  const updateFlags = parsePriceUpdateFlags(documentToEdit.internalnote);

  return (documentToEdit.items ?? []).map((item, idx) => {
    const line = lineInputs[idx];
    const productLabel = item.productcode ? `${item.productname} (${item.productcode})` : item.productname;
    const fallbackTotalCost = Math.max(0, Number(item.price ?? 0) * Number(item.quantity ?? 0));

    return {
      lineId: newLineId(),
      documentItemId: Number(item.id),
      productId: Number(item.productid),
      productLabel,
      quantity: Number(item.quantity ?? 0) || 0,
      totalCost: Number(line?.totalCost ?? fallbackTotalCost) || 0,
      discountPercentage: Number(line?.discountPercentage ?? 0) || 0,
      marginPercentage: Number(line?.marginPercentage ?? 0) || 0,
      freightId: String(line?.freightId ?? '1'),
      purchaseReference: String(line?.purchaseReference ?? item.productcode ?? ''),
      warehouseReference: String(line?.warehouseReference ?? ''),
      updateProductPrice: updateFlags.has(Number(item.id)),
      remove: false,
    };
  });
}

function formatMoney(amount: number) {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function newLineId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export function NewDocumentForm({ mode = 'create', documentToEdit }: NewDocumentFormProps) {
  const isEditMode = mode === 'edit' && Boolean(documentToEdit?.id);
  const editDocumentId = isEditMode ? Number(documentToEdit?.id) : null;
  const isFinalizedEdit = isEditMode && Boolean(documentToEdit?.isclockedout);
  const { toast } = useToast();
  const productsCatalog = useProductsCatalog();
  const submitLockRef = React.useRef(false);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [finalizing, setFinalizing] = React.useState(false);

  const [resultOpen, setResultOpen] = React.useState(false);
  const [resultKind, setResultKind] = React.useState<'finalized' | 'created_not_finalized'>('finalized');
  const [resultTitle, setResultTitle] = React.useState<string>('');
  const [resultDescription, setResultDescription] = React.useState<string>('');
  const [resultDocumentId, setResultDocumentId] = React.useState<number | null>(null);
  const [resultDocumentNumber, setResultDocumentNumber] = React.useState<string | null>(null);
  const [retryingFinalize, setRetryingFinalize] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmFinalize] = React.useState(true);

  const [customers, setCustomers] = React.useState<SelectOption[]>([]);
  const [countries, setCountries] = React.useState<CountryListItem[]>([]);
  const [productGroups, setProductGroups] = React.useState<ProductGroup[]>([]);
  const [currencies, setCurrencies] = React.useState<CurrencyListItem[]>([]);
  const [warehouses, setWarehousesState] = React.useState<SelectOption[]>([]);
  const [documentTypes, setDocumentTypesState] = React.useState<SelectOption[]>([]);

  const [warehouseId, setWarehouseId] = React.useState<number | ''>(
    isEditMode && documentToEdit?.warehouseid ? Number(documentToEdit.warehouseid) : ''
  );
  const [documentTypeId, setDocumentTypeId] = React.useState<number | ''>(
    isEditMode && documentToEdit?.documenttypeid ? Number(documentToEdit.documenttypeid) : ''
  );
  const [customerId, setCustomerId] = React.useState<number | ''>(
    isEditMode && documentToEdit?.customerid ? Number(documentToEdit.customerid) : ''
  );

  // Supplier search dialog
  const [supplierDialogOpen, setSupplierDialogOpen] = React.useState(false);
  const [supplierQuery, setSupplierQuery] = React.useState('');
  const [supplierResults, setSupplierResults] = React.useState<CustomerSearchResult[]>([]);
  const [supplierSearching, setSupplierSearching] = React.useState(false);

  const [date, setDate] = React.useState(() => (isEditMode ? String(documentToEdit?.date ?? todayYmd()) : todayYmd()));

  const [referenceDocumentNumber, setReferenceDocumentNumber] = React.useState(
    isEditMode ? String(documentToEdit?.referencedocumentnumber ?? '') : ''
  );
  const [note, setNote] = React.useState(isEditMode ? String(documentToEdit?.note ?? '') : '');

  // Payment status (0=pending/unpaid, 2=paid)
  const [paidStatus, setPaidStatus] = React.useState<0 | 2>(
    isEditMode && Number(documentToEdit?.paidstatus) === 0 ? 0 : 2
  );

  const [items, setItems] = React.useState<DraftItem[]>(() => buildInitialItems(documentToEdit));

  // Liquidación: configuración global (basada en la calculadora)
  const [ivaPercentage, setIvaPercentage] = React.useState<number | ''>(
    isEditMode ? Number(documentToEdit?.liquidation?.config?.ivaPercentage ?? 19) : 19
  );
  const [ivaIncludedInCost, setIvaIncludedInCost] = React.useState(
    isEditMode ? Boolean(documentToEdit?.liquidation?.config?.ivaIncludedInCost) : false
  );
  const [discountsEnabled, setDiscountsEnabled] = React.useState(
    isEditMode ? Boolean(documentToEdit?.liquidation?.config?.discountsEnabled ?? true) : true
  );
  const [globalMargin, setGlobalMargin] = React.useState<number | ''>(() => {
    if (!isEditMode) return 40;
    const firstLine = documentToEdit?.liquidation?.lineInputs?.[0];
    return Number(firstLine?.marginPercentage ?? 40);
  });

  const [ivaPercentageText, setIvaPercentageText] = React.useState<string>(toUserDecimalText(ivaPercentage));
  const ivaFocusedRef = React.useRef(false);

  const [globalMarginText, setGlobalMarginText] = React.useState<string>(toUserDecimalText(globalMargin));
  const globalMarginFocusedRef = React.useRef(false);

  const [useMultipleFreights, setUseMultipleFreights] = React.useState(
    isEditMode ? Boolean(documentToEdit?.liquidation?.config?.useMultipleFreights) : false
  );
  const [freightRates, setFreightRates] = React.useState<LiquidationFreightRate[]>(() => {
    const fromDoc = documentToEdit?.liquidation?.config?.freightRates ?? [];
    if (isEditMode && fromDoc.length > 0) {
      return fromDoc.map((f) => ({ id: String(f.id), name: String(f.name), cost: Number(f.cost ?? 0) || 0 }));
    }
    return [{ id: '1', name: 'Flete 1', cost: 0 }];
  });

  const [editingFreightId, setEditingFreightId] = React.useState<string | null>(null);
  const [editingFreightCostText, setEditingFreightCostText] = React.useState<string>('');

  const [editingItemCell, setEditingItemCell] = React.useState<{
    lineId: string;
    field: 'quantity' | 'totalCost' | 'discountPercentage' | 'marginPercentage';
  } | null>(null);
  const [editingItemText, setEditingItemText] = React.useState<string>('');

  React.useEffect(() => {
    if (ivaFocusedRef.current) return;
    setIvaPercentageText(toUserDecimalText(ivaPercentage));
  }, [ivaPercentage]);

  React.useEffect(() => {
    if (globalMarginFocusedRef.current) return;
    setGlobalMarginText(toUserDecimalText(globalMargin));
  }, [globalMargin]);

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
  const [newProductGroupId, setNewProductGroupId] = React.useState<number | ''>('');
  const [newProductCurrencyId, setNewProductCurrencyId] = React.useState<number | ''>('');
  const [newProductMeasurementUnit, setNewProductMeasurementUnit] = React.useState('');
  const [newProductIsEnabled, setNewProductIsEnabled] = React.useState(true);
  const [newProductIsService, setNewProductIsService] = React.useState(false);

  // Product search dialog
  const [productDialogOpen, setProductDialogOpen] = React.useState(false);
  const [productQuery, setProductQuery] = React.useState('');
  const [productResults, setProductResults] = React.useState<DocumentProductSearchResult[]>([]);
  const [productSearching, setProductSearching] = React.useState(false);
  const [onlySupplierProducts, setOnlySupplierProducts] = React.useState(false);
  const [supplierProductIdsByCustomer, setSupplierProductIdsByCustomer] = React.useState<Record<number, number[]>>({});
  const [supplierProductsLoading, setSupplierProductsLoading] = React.useState(false);

  const productGroupNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const group of productGroups) {
      const id = Number(group?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      map.set(id, String(group?.name ?? ''));
    }
    return map;
  }, [productGroups]);

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

  const activeItems = React.useMemo(
    () => items.filter((it) => !it.remove),
    [items]
  );

  const liquidation = React.useMemo(() => {
    const lines: LiquidationLineInput[] = activeItems.map((it, idx) => ({
      id: it.lineId,
      productId: typeof it.productId === 'number' ? it.productId : undefined,
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
  }, [activeItems, liquidationConfig]);

  const liquidationByLineId = React.useMemo(() => {
    const map = new Map<string, (typeof liquidation.lines)[number]>();
    activeItems.forEach((it, idx) => {
      map.set(it.lineId, liquidation.lines[idx]);
    });
    return map;
  }, [activeItems, liquidation.lines]);

  React.useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        const SUPPLIER_PICKER_LIMIT = 2000;
        const [countriesRes, suppliersRes, wh, dt, pgRes, curRes] = await Promise.all([
          getCountries(),
          searchCustomersAction('', SUPPLIER_PICKER_LIMIT, { onlyEnabled: true, onlySuppliers: true }),
          getWarehouses({ onlyEnabled: true }),
          getDocumentTypes(),
          getProductGroups(),
          getCurrencies(),
        ]);

        setCountries(countriesRes.data ?? []);
        setProductGroups(pgRes.data ?? []);
        setCurrencies(curRes.data ?? []);

        // Default currency to COP if available.
        const cop = (curRes.data ?? []).find((c) => String(c?.code ?? '').toUpperCase() === 'COP');
        if (cop && newProductCurrencyId === '') setNewProductCurrencyId(Number(cop.idCurrency));
        setSupplierResults(suppliersRes.data ?? []);
        setCustomers((suppliersRes.data ?? []).map((c) => ({ value: Number(c.idCustomer), label: String(c.name) })));

        setWarehousesState(
          (wh.data ?? []).map((w: any) => ({ value: Number(w.idWarehouse), label: String(w.name) }))
        );

        // In create mode prioritize purchase types; in edit mode keep all enabled types.
        const sourceTypes = isEditMode
          ? (dt.data ?? [])
          : (() => {
              const purchaseTypes = (dt.data ?? []).filter((d: any) => Number(d?.documentCategoryId ?? 0) === 1);
              return purchaseTypes.length ? purchaseTypes : (dt.data ?? []);
            })();

        const raw = sourceTypes
          .filter((d: any) => d?.isEnabled !== false)
          .map((d: any) => {
            const base = String(d?.name ?? '').trim();
            const prefix = stockDirectionLabelEs(d?.stockDirection);
            return {
              value: Number(d.documentTypeId),
              baseLabel: `${prefix} — ${base || 'Documento'}`,
              code: d?.code ?? null,
            };
          });

        const labelCounts = new Map<string, number>();
        for (const r of raw) {
          labelCounts.set(r.baseLabel, (labelCounts.get(r.baseLabel) ?? 0) + 1);
        }

        const options = raw
          .filter((r) => Number.isFinite(r.value) && r.value > 0)
          .map((r) => {
            const needsSuffix = (labelCounts.get(r.baseLabel) ?? 0) > 1;
            const suffix = needsSuffix
              ? ` (#${r.value}${r.code ? `, ${String(r.code)}` : ''})`
              : '';
            return { value: r.value, label: `${r.baseLabel}${suffix}` };
          });

        setDocumentTypesState(options);
        if (!isEditMode && documentTypeId === '' && options.length === 1) {
          setDocumentTypeId(options[0].value);
        }
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudo cargar data' });
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, [toast, documentTypeId, isEditMode]);

  React.useEffect(() => {
    void productsCatalog.ensureLoaded();
  }, [productsCatalog]);

  React.useEffect(() => {
    const supplierId = typeof customerId === 'number' ? customerId : null;
    if (!productDialogOpen || !onlySupplierProducts || !supplierId || supplierId <= 0) return;
    if (supplierProductIdsByCustomer[supplierId]) return;

    let cancelled = false;

    async function loadSupplierProducts() {
      setSupplierProductsLoading(true);
      try {
        const res = await getSupplierProductIdsAction(supplierId, { maxDocs: 15, maxItems: 500 });
        if (cancelled) return;
        if (res.error) {
          toast({ variant: 'destructive', title: 'Error', description: res.error });
          return;
        }
        setSupplierProductIdsByCustomer((prev) => ({
          ...prev,
          [supplierId]: res.data ?? [],
        }));
      } finally {
        if (!cancelled) setSupplierProductsLoading(false);
      }
    }

    void loadSupplierProducts();

    return () => {
      cancelled = true;
    };
  }, [productDialogOpen, onlySupplierProducts, customerId, supplierProductIdsByCustomer, toast]);

  async function retryFinalizeExisting(): Promise<void> {
    const documentId = resultDocumentId;
    if (!documentId) return;
    setRetryingFinalize(true);
    try {
      const fin = await finalizeDocumentAction({ documentId });
      if (!fin?.success) throw new Error(fin?.error || 'No se pudo finalizar el documento');

      setResultKind('finalized');
      setResultTitle('Documento finalizado');
      setResultDescription('Stock y Kardex fueron actualizados correctamente.');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudo finalizar' });
    } finally {
      setRetryingFinalize(false);
    }
  }

  React.useEffect(() => {
    const handle = setTimeout(async () => {
      if (!supplierDialogOpen) return;

      const q = supplierQuery.trim();
      setSupplierSearching(true);
      const res = await searchCustomersAction(q, 200, { onlyEnabled: true, onlySuppliers: true });
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

      const supplierId = typeof customerId === 'number' ? customerId : null;
      const supplierProductIds = supplierId ? supplierProductIdsByCustomer[supplierId] ?? null : null;
      const canUseCatalog =
        productsCatalog.status === 'ready' &&
        (!onlySupplierProducts || !!supplierProductIds);

      if (canUseCatalog) {
        const allowedSupplierProductIds = supplierProductIds ? new Set(supplierProductIds) : null;
        const ranked = (productsCatalog.products ?? [])
          .filter((product) => {
            if (!allowedSupplierProductIds) return true;
            return allowedSupplierProductIds.has(Number(product.id));
          })
          .map((product) => {
            const result: DocumentProductSearchResult = {
              idProduct: Number(product.id),
              name: String(product.name ?? ''),
              code: product.code ?? null,
              cost: product.cost ?? null,
              price: product.price ?? null,
              productGroupId: product.productGroupId ?? null,
              productGroupName:
                product.productGroupId && productGroupNameById.has(Number(product.productGroupId))
                  ? productGroupNameById.get(Number(product.productGroupId)) ?? null
                  : null,
              measurementUnit: product.measurementUnit ?? null,
            };
            const rank = rankCatalogProduct(result, q);
            return rank ? { result: { ...result, matchLabel: rank.matchLabel }, score: rank.score } : null;
          })
          .filter((entry): entry is { result: DocumentProductSearchResult; score: number } => Boolean(entry))
          .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            return left.result.name.localeCompare(right.result.name, 'es');
          })
          .slice(0, q ? 50 : 30)
          .map((entry) => entry.result);

        setProductResults(ranked);
        setProductSearching(false);
        return;
      }

      const res = await searchProductsAction(q, 30, {
        supplierId: typeof customerId === 'number' ? customerId : undefined,
        onlySupplierProducts: onlySupplierProducts && typeof customerId === 'number',
      });
      setProductResults(
        (res.data ?? []).map((product) => ({
          ...product,
          productGroupName: null,
          measurementUnit: null,
          matchLabel: null,
        }))
      );
      setProductSearching(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [
    productQuery,
    productDialogOpen,
    customerId,
    onlySupplierProducts,
    productsCatalog.products,
    productsCatalog.status,
    productGroupNameById,
    supplierProductIdsByCustomer,
  ]);

  function addProduct(p: ProductSearchResult) {
    const label = p.code ? `${p.name} (${p.code})` : p.name;
    const unitCostSeed = Number(p.cost ?? p.price ?? 0);
    const marginSeed = typeof globalMargin === 'number' ? globalMargin : 30;
    setItems((prev) => [
      ...prev,
      {
        lineId: newLineId(),
        documentItemId: undefined,
        productId: p.idProduct,
        productLabel: label,
        quantity: 1,
        totalCost: unitCostSeed,
        discountPercentage: 0,
        marginPercentage: marginSeed,
        freightId: freightRates[0]?.id ?? '1',
        purchaseReference: p.code ? String(p.code) : '',
        warehouseReference: '',
        updateProductPrice: false,
        remove: false,
      },
    ]);
    setProductDialogOpen(false);
    setProductQuery('');
    setProductResults([]);
  }

  function addDraftProduct(p: DraftProduct) {
    const label = p.code ? `${p.name} (${p.code})` : p.name;
    const marginSeed = typeof globalMargin === 'number' ? globalMargin : 30;
    setItems((prev) => [
      ...prev,
      {
        lineId: newLineId(),
        documentItemId: undefined,
        productId: null,
        productLabel: `${label} (nuevo)`,
        draftProduct: p,
        quantity: 1,
        totalCost: 0,
        discountPercentage: 0,
        marginPercentage: marginSeed,
        freightId: freightRates[0]?.id ?? '1',
        purchaseReference: p.code ? String(p.code) : '',
        warehouseReference: '',
        updateProductPrice: false,
        remove: false,
      },
    ]);

    setCreateProductOpen(false);
    setProductDialogOpen(false);
    setProductQuery('');
    setProductResults([]);
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => {
      const target = prev[idx];
      if (!target) return prev;

      if (isEditMode && Number(target.documentItemId) > 0) {
        return prev.map((it, i) => (i === idx ? { ...it, remove: !it.remove } : it));
      }

      return prev.filter((_, i) => i !== idx);
    });
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

      const suppliersRes = await searchCustomersAction('', 2000, { onlyEnabled: true, onlySuppliers: true });
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
      addDraftProduct({
        name,
        code: newProductCode || undefined,
        productGroupId: typeof newProductGroupId === 'number' ? newProductGroupId : undefined,
        currencyId: typeof newProductCurrencyId === 'number' ? newProductCurrencyId : undefined,
        measurementUnit: newProductMeasurementUnit || undefined,
        isEnabled: Boolean(newProductIsEnabled),
        isService: Boolean(newProductIsService),
      });

      setNewProductName('');
      setNewProductCode('');
      setNewProductGroupId('');
      setNewProductMeasurementUnit('');
      setNewProductIsEnabled(true);
      setNewProductIsService(false);
      toast({ title: 'Producto agregado', description: 'Se creará al confirmar el documento.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'No se pudo crear el producto' });
    }
  }

  async function handleSave() {
    if (submitLockRef.current) {
      toast({ variant: 'destructive', title: 'En proceso', description: 'Ya hay un guardado/finalización en curso.' });
      return;
    }

    submitLockRef.current = true;
    setSaving(isEditMode);
    setFinalizing(!isEditMode);

    const progress = toast({
      title: isEditMode ? 'Guardando cambios…' : 'Finalizando…',
      description: 'Preparando datos…',
    });

    let createdDocumentId: number | null = null;
    let createdDocumentNumber: string | null = null;

    try {
      if (!warehouseId || !documentTypeId) {
        throw new Error('Selecciona Almacén y Tipo de documento.');
      }
      if (activeItems.length === 0) {
        throw new Error('Agrega al menos 1 item.');
      }

      const liqLines = liquidation.lines;

      const productsMeta: {
        created: Array<{ lineId: string; idProduct: number; name: string; code?: string }>;
        existing: Array<{ lineId: string; idProduct: number; name: string; code?: string }>;
      } = { created: [], existing: [] };

      // Create any draft products right before saving/finalizing.
      const draftToCreate = activeItems
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => typeof it.productId !== 'number' && it.draftProduct);

      let resolvedItems: DraftItem[] = items;
      if (draftToCreate.length > 0) {
        (progress as any).update({
          title: 'Creando productos…',
          description: `${draftToCreate.length} producto(s) nuevo(s) en este documento…`,
        });

        const createRes = await createProductsFromDocumentLinesAction({
          lines: draftToCreate.map(({ it, idx }) => {
            const li = liqLines[idx];
            const name = it.draftProduct?.name ?? it.productLabel;
            const code = it.draftProduct?.code || it.purchaseReference || undefined;
            return {
              lineId: it.lineId,
              name,
              code,
              productGroupId: it.draftProduct?.productGroupId,
              currencyId: it.draftProduct?.currencyId,
              measurementUnit: it.draftProduct?.measurementUnit,
              isEnabled: it.draftProduct?.isEnabled ?? true,
              isService: it.draftProduct?.isService ?? false,
              isTaxInclusivePrice: true,
              cost: li?.unitFinalCost ?? 0,
              price: li?.unitSalePrice ?? 0,
              markup: Number(it.marginPercentage) || 0,
            };
          }),
        });

        if (!createRes.success || !createRes.created) {
          throw new Error(createRes.error || 'No se pudieron crear productos pendientes');
        }

        const idByLineId = new Map(createRes.created.map((x: any) => [x.lineId, Number(x.idProduct)] as const));
        const createdByLineId = new Map(createRes.created.map((x: any) => [x.lineId, Boolean(x.created)] as const));

        resolvedItems = items.map((it) => {
          if (typeof it.productId === 'number') return it;
          const idProduct = idByLineId.get(it.lineId);
          if (!idProduct) return it;

          const name = it.draftProduct?.name ?? it.productLabel;
          const code = it.draftProduct?.code || it.purchaseReference || undefined;
          const label = code ? `${name} (${code})` : name;
          const created = createdByLineId.get(it.lineId) ?? true;

          (created ? productsMeta.created : productsMeta.existing).push({
            lineId: it.lineId,
            idProduct,
            name,
            ...(code ? { code } : {}),
          });

          return {
            ...it,
            productId: idProduct,
            productLabel: label,
            draftProduct: undefined,
          };
        });
      }

      const resolvedActiveItems = resolvedItems.filter((it) => !it.remove);

      if (resolvedActiveItems.some((it) => typeof it.productId !== 'number' || it.productId <= 0)) {
        throw new Error('Hay productos pendientes sin ID. Revisa los ítems antes de guardar.');
      }

      // Add already-existing selected products to metadata (so the document can report new vs existing lines).
      {
        const seenLineIds = new Set<string>([
          ...productsMeta.created.map((p) => p.lineId),
          ...productsMeta.existing.map((p) => p.lineId),
        ]);

        for (const it of resolvedActiveItems) {
          if (typeof it.productId !== 'number' || it.productId <= 0) continue;
          if (seenLineIds.has(it.lineId)) continue;
          productsMeta.existing.push({
            lineId: it.lineId,
            idProduct: Number(it.productId),
            name: String(it.productLabel ?? `#${it.productId}`),
          });
        }
      }

      const liquidationLineInputs = resolvedActiveItems.map((it, idx) => ({
        id: String(idx + 1),
        productId: it.productId ?? undefined,
        name: it.productLabel,
        purchaseReference: it.purchaseReference,
        warehouseReference: it.warehouseReference,
        quantity: it.quantity,
        totalCost: it.totalCost,
        discountPercentage: it.discountPercentage,
        marginPercentage: it.marginPercentage,
        freightId: it.freightId,
        updateProductPrice: Boolean(it.updateProductPrice),
      }));

      const mergedInternalNote = (() => {
        const raw = documentToEdit?.internalnote;
        let parsed: any = {};
        if (typeof raw === 'string' && raw.trim().startsWith('{')) {
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = {};
          }
        }

        return {
          ...parsed,
          liquidation: {
            version: 1,
            config: {
              ivaPercentage: typeof ivaPercentage === 'number' ? ivaPercentage : 0,
              ivaIncludedInCost,
              discountsEnabled,
              useMultipleFreights,
              freightRates,
            },
            lineInputs: liquidationLineInputs,
            totals: liquidation.totals,
          },
          products: productsMeta,
        };
      })();

      if (isEditMode && editDocumentId) {
        (progress as any).update({
          title: 'Actualizando documento…',
          description: 'Guardando encabezado e ítems…',
        });

        const headerRes = await updateDocumentHeaderAction({
          documentId: Number(editDocumentId),
          userId: Number(documentToEdit?.userid ?? 1),
          customerId: typeof customerId === 'number' ? Number(customerId) : undefined,
          warehouseId: Number(warehouseId),
          documentTypeId: Number(documentTypeId),
          date,
          paidStatus,
          referenceDocumentNumber: referenceDocumentNumber || undefined,
          note: note || undefined,
          internalNote: JSON.stringify(mergedInternalNote),
        });

        if (!headerRes.success) {
          throw new Error(headerRes.error || 'No se pudo actualizar el encabezado');
        }

        const itemPayload = [
          ...resolvedActiveItems.map((it, idx) => {
            const base = {
              quantity: Number(it.quantity) || 0,
              price: Number(liqLines[idx]?.unitFinalCost ?? 0) || 0,
              updateProductPrice: Boolean(it.updateProductPrice),
            };

            if (Number(it.documentItemId) > 0) {
              return {
                documentItemId: Number(it.documentItemId),
                ...base,
              };
            }

            return {
              productId: Number(it.productId ?? 0),
              ...base,
            };
          }),
          ...resolvedItems
            .filter((it) => it.remove && Number(it.documentItemId) > 0)
            .map((it) => ({
              documentItemId: Number(it.documentItemId),
              quantity: 0,
              price: 0,
              remove: true,
              updateProductPrice: false,
            })),
        ];

        const itemsRes = await updateDocumentItemsAction({
          documentId: Number(editDocumentId),
          items: itemPayload,
        });

        if (!itemsRes.success) {
          throw new Error(itemsRes.error || 'No se pudieron actualizar los ítems');
        }

        setItems((prev) => prev.filter((it) => !it.remove));

        (progress as any).dismiss?.();
        setResultKind('finalized');
        setResultDocumentId(Number(editDocumentId));
        setResultDocumentNumber(documentToEdit?.number ?? null);
        setResultTitle('Documento actualizado');
        setResultDescription('Se guardaron los cambios del encabezado, liquidación e ítems.');
        setResultOpen(true);
        return;
      }

      (progress as any).update({
        title: 'Creando documento…',
        description: 'Subiendo encabezado e ítems…',
      });

      const created = await createDocumentAction({
        userId: 1,
        customerId: customerId ? Number(customerId) : undefined,
        warehouseId: Number(warehouseId),
        documentTypeId: Number(documentTypeId),
        date,
        paidStatus,
        referenceDocumentNumber: referenceDocumentNumber || undefined,
        note: note || undefined,
        internalNote: JSON.stringify(mergedInternalNote),
        items: resolvedActiveItems.map((it, idx) => ({
          productId: Number(it.productId ?? 0),
          quantity: it.quantity,
          price: liqLines[idx]?.unitFinalCost ?? 0,
          productCost: liqLines[idx]?.unitFinalCost ?? 0,
        })),
      });

      if (!created.success || !created.documentId) {
        throw new Error(created.error || 'No se pudo crear el documento');
      }

      createdDocumentId = Number(created.documentId);
      createdDocumentNumber = created.documentNumber ? String(created.documentNumber) : null;

      (progress as any).update({
        title: 'Documento creado',
        description: created.documentNumber ? `Número: ${created.documentNumber}` : 'Documento creado. Continuando…',
      });

      (progress as any).update({
        title: 'Finalizando…',
        description: 'Impactando Stock y generando Kardex…',
      });
      const fin = await finalizeDocumentAction({ documentId: createdDocumentId });
      if (!fin?.success) {
        // IMPORTANT: the document was created, but inventory posting failed.
        (progress as any).dismiss?.();
        setResultKind('created_not_finalized');
        setResultDocumentId(createdDocumentId);
        setResultDocumentNumber(createdDocumentNumber);
        setResultTitle('Documento creado, pero no finalizado');
        setResultDescription(
          `${fin?.error || 'No se pudo finalizar el documento'}\n\nCorrige el documento y reintenta finalizar desde Documentos.`
        );
        setResultOpen(true);
        return;
      }

      (progress as any).dismiss?.();

      setResultKind('finalized');
      setResultDocumentId(createdDocumentId);
      setResultDocumentNumber(createdDocumentNumber);
      setResultTitle('Documento finalizado');
      setResultDescription(
        createdDocumentNumber
          ? `Número: ${createdDocumentNumber}`
          : 'Stock y Kardex fueron actualizados correctamente.'
      );
      setResultOpen(true);
    } catch (e: any) {
      (progress as any).dismiss?.();
      toast({ variant: 'destructive', title: 'Error', description: e?.message ?? 'Error inesperado' });
    } finally {
      setSaving(false);
      setFinalizing(false);
      submitLockRef.current = false;
    }
  }

  function requestSave() {
    if (isEditMode) {
      handleSave();
      return;
    }
    setConfirmOpen(true);
  }

  function selectedSupplierLabel() {
    if (typeof customerId !== 'number') return '(Opcional)';
    const found = customers.find((c) => c.value === customerId);
    return found?.label ?? `ID ${customerId}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resultKind === 'created_not_finalized' ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              )}
              {resultTitle}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-line">{resultDescription}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="text-muted-foreground">Documento</div>
              <div className="font-medium">{resultDocumentNumber ?? (resultDocumentId ? `#${resultDocumentId}` : '—')}</div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResultOpen(false)}>
              Cerrar
            </Button>
            {resultDocumentId ? (
              <Button variant="outline" asChild>
                <Link href={`/documents?documentId=${encodeURIComponent(String(resultDocumentId))}`}>Abrir documento</Link>
              </Button>
            ) : null}
            {resultKind === 'finalized' && resultDocumentId ? (
              <Button asChild>
                <Link href={`/documents/${encodeURIComponent(String(resultDocumentId))}/pdf`}>Ver PDF</Link>
              </Button>
            ) : null}
            {resultKind === 'created_not_finalized' ? (
              <Button onClick={retryFinalizeExisting} disabled={retryingFinalize || !resultDocumentId}>
                {retryingFinalize ? 'Reintentando…' : 'Reintentar finalizar'}
              </Button>
            ) : (
              <Button asChild>
                <Link href="/documents">Ir a Documentos</Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditMode ? `Editar documento #${documentToEdit?.number ?? ''}` : 'Nuevo documento'}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode
              ? 'Edita encabezado, liquidación e ítems del documento con trazabilidad completa.'
              : 'Entrada (compra) / Salida (venta). Al confirmar, el documento se finaliza con impacto en Stock y Kardex.'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/documents">Volver</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Encabezado</CardTitle>
          <CardDescription>
            {isEditMode ? 'Actualiza almacén, tipo, proveedor, fecha y metadatos.' : 'Selecciona almacén, tipo, proveedor y fecha.'}
            {isFinalizedEdit ? ' En documentos finalizados, almacén y tipo se mantienen bloqueados para proteger la trazabilidad de stock.' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Almacén</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
              disabled={loading || isFinalizedEdit}
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
              disabled={loading || isFinalizedEdit}
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
            <Label>Factura</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={paidStatus}
              onChange={(e) => setPaidStatus(e.target.value === '2' ? 2 : 0)}
              disabled={loading}
            >
              <option value={0}>No paga</option>
              <option value={2}>Paga</option>
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
              type="text"
              inputMode="decimal"
              value={ivaPercentageText}
              onFocus={() => {
                ivaFocusedRef.current = true;
                setIvaPercentageText(toUserDecimalText(ivaPercentage));
              }}
              onBlur={() => {
                ivaFocusedRef.current = false;
                setIvaPercentageText(toUserDecimalText(ivaPercentage));
              }}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setIvaPercentage('');
                  setIvaPercentageText('');
                  return;
                }
                const n = parseDecimalLooseOptional(raw);
                setIvaPercentageText(raw);
                if (typeof n === 'number' && Number.isFinite(n)) setIvaPercentage(Math.max(0, n));
              }}
            />
            <div className="flex items-center gap-2">
              <Checkbox checked={ivaIncludedInCost} onCheckedChange={(v) => setIvaIncludedInCost(Boolean(v))} />
              <span className="text-xs text-muted-foreground">IVA ya incluido en costo</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Margen global (%)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={globalMarginText}
              onFocus={() => {
                globalMarginFocusedRef.current = true;
                setGlobalMarginText(toUserDecimalText(globalMargin));
              }}
              onBlur={() => {
                globalMarginFocusedRef.current = false;
                setGlobalMarginText(toUserDecimalText(globalMargin));
              }}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setGlobalMargin('');
                  setGlobalMarginText('');
                  return;
                }
                const n = parseDecimalLooseOptional(raw);
                setGlobalMarginText(raw);
                if (typeof n === 'number' && Number.isFinite(n)) setGlobalMargin(Math.max(0, n));
              }}
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
                  type="text"
                  inputMode="decimal"
                  value={editingFreightId === f.id ? editingFreightCostText : toUserDecimalText(f.cost)}
                  onFocus={() => {
                    setEditingFreightId(f.id);
                    setEditingFreightCostText(toUserDecimalText(f.cost));
                  }}
                  onBlur={() => {
                    setEditingFreightId((prev) => (prev === f.id ? null : prev));
                    setEditingFreightCostText('');
                  }}
                  onChange={(e) => {
                    const raw = String(e.target.value ?? '');
                    setEditingFreightCostText(raw);

                    if (raw.trim() === '') {
                      updateFreightRate(f.id, { cost: 0 });
                      return;
                    }

                    const n = parseDecimalLooseOptional(raw);
                    if (typeof n === 'number' && Number.isFinite(n)) updateFreightRate(f.id, { cost: Math.max(0, n) });
                  }}
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
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    items.every((it) => Boolean(it.updateProductPrice))
                      ? true
                      : items.some((it) => Boolean(it.updateProductPrice))
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    setItems((prev) => prev.map((it) => ({ ...it, updateProductPrice: next })));
                  }}
                />
                <Label className="text-sm">¿Actualizar precio del producto desde documento? (todos)</Label>
              </div>

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
                    <TableHead className="min-w-[160px]">Actualizar precio</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => {
                    const li = liquidationByLineId.get(it.lineId);
                    return (
                      <TableRow key={it.lineId} className={it.remove ? 'opacity-50' : undefined}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{it.productLabel}</span>
                            {it.remove ? (
                              <span className="text-xs text-destructive">Marcado para eliminar al guardar</span>
                            ) : null}
                            {typeof it.productId !== 'number' ? (
                              <span className="text-xs text-muted-foreground">Pendiente: se creará al confirmar</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input value={it.purchaseReference} onChange={(e) => updateItem(idx, { purchaseReference: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Input value={it.warehouseReference} onChange={(e) => updateItem(idx, { warehouseReference: e.target.value })} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            inputMode="decimal"
                            min={0}
                            className="w-24 text-right"
                            value={
                              editingItemCell?.lineId === it.lineId && editingItemCell.field === 'quantity'
                                ? editingItemText
                                : toUserDecimalText(it.quantity)
                            }
                            onFocus={() => {
                              setEditingItemCell({ lineId: it.lineId, field: 'quantity' });
                              setEditingItemText(toUserDecimalText(it.quantity));
                            }}
                            onBlur={() => {
                              setEditingItemCell((prev) => {
                                if (prev?.lineId === it.lineId && prev.field === 'quantity') return null;
                                return prev;
                              });
                              setEditingItemText('');
                            }}
                            onChange={(e) => {
                              const raw = String(e.target.value ?? '');
                              setEditingItemText(raw);
                              if (raw.trim() === '') {
                                updateItem(idx, { quantity: 0 });
                                return;
                              }
                              const n = parseDecimalLooseOptional(raw);
                              if (typeof n === 'number' && Number.isFinite(n)) updateItem(idx, { quantity: Math.max(0, n) });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            inputMode="decimal"
                            min={0}
                            className="w-32 text-right"
                            value={
                              editingItemCell?.lineId === it.lineId && editingItemCell.field === 'totalCost'
                                ? editingItemText
                                : toUserDecimalText(it.totalCost)
                            }
                            onFocus={() => {
                              setEditingItemCell({ lineId: it.lineId, field: 'totalCost' });
                              setEditingItemText(toUserDecimalText(it.totalCost));
                            }}
                            onBlur={() => {
                              setEditingItemCell((prev) => {
                                if (prev?.lineId === it.lineId && prev.field === 'totalCost') return null;
                                return prev;
                              });
                              setEditingItemText('');
                            }}
                            onChange={(e) => {
                              const raw = String(e.target.value ?? '');
                              setEditingItemText(raw);
                              if (raw.trim() === '') {
                                updateItem(idx, { totalCost: 0 });
                                return;
                              }
                              const n = parseDecimalLooseOptional(raw);
                              if (typeof n === 'number' && Number.isFinite(n)) updateItem(idx, { totalCost: Math.max(0, n) });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            inputMode="decimal"
                            min={0}
                            className="w-24 text-right"
                            value={
                              editingItemCell?.lineId === it.lineId && editingItemCell.field === 'discountPercentage'
                                ? editingItemText
                                : toUserDecimalText(it.discountPercentage)
                            }
                            onFocus={() => {
                              setEditingItemCell({ lineId: it.lineId, field: 'discountPercentage' });
                              setEditingItemText(toUserDecimalText(it.discountPercentage));
                            }}
                            onBlur={() => {
                              setEditingItemCell((prev) => {
                                if (prev?.lineId === it.lineId && prev.field === 'discountPercentage') return null;
                                return prev;
                              });
                              setEditingItemText('');
                            }}
                            onChange={(e) => {
                              const raw = String(e.target.value ?? '');
                              setEditingItemText(raw);
                              if (raw.trim() === '') {
                                updateItem(idx, { discountPercentage: 0 });
                                return;
                              }
                              const n = parseDecimalLooseOptional(raw);
                              if (typeof n === 'number' && Number.isFinite(n)) updateItem(idx, { discountPercentage: Math.max(0, n) });
                            }}
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
                            type="text"
                            inputMode="decimal"
                            min={0}
                            className="w-24 text-right"
                            value={
                              editingItemCell?.lineId === it.lineId && editingItemCell.field === 'marginPercentage'
                                ? editingItemText
                                : toUserDecimalText(it.marginPercentage)
                            }
                            onFocus={() => {
                              setEditingItemCell({ lineId: it.lineId, field: 'marginPercentage' });
                              setEditingItemText(toUserDecimalText(it.marginPercentage));
                            }}
                            onBlur={() => {
                              setEditingItemCell((prev) => {
                                if (prev?.lineId === it.lineId && prev.field === 'marginPercentage') return null;
                                return prev;
                              });
                              setEditingItemText('');
                            }}
                            onChange={(e) => {
                              const raw = String(e.target.value ?? '');
                              setEditingItemText(raw);
                              if (raw.trim() === '') {
                                updateItem(idx, { marginPercentage: 0 });
                                return;
                              }
                              const n = parseDecimalLooseOptional(raw);
                              if (typeof n === 'number' && Number.isFinite(n)) updateItem(idx, { marginPercentage: Math.max(0, n) });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(li?.unitSalePrice ?? 0)}</TableCell>
                        <TableCell className="text-right">{formatMoney(li?.totalFinalCost ?? 0)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={Boolean(it.updateProductPrice)}
                              onCheckedChange={(checked) => updateItem(idx, { updateProductPrice: checked === true })}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                            {it.remove ? 'Restaurar' : 'Quitar'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                </Table>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-6 pt-2">
            <div className="text-sm text-muted-foreground">Total (costo final)</div>
            <div className="text-lg font-semibold">{formatMoney(liquidation.totals.totalFinalCost)}</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button onClick={() => requestSave()} disabled={saving || finalizing || loading}>
              {isEditMode ? (saving ? 'Guardando…' : 'Guardar cambios') : (finalizing ? 'Finalizando…' : 'Finalizar (Stock + Kardex)')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar finalización
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción impacta Stock y genera Kardex. Verifica cantidades y costos antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="text-muted-foreground">Items</div>
              <div className="font-medium">{activeItems.length}</div>
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
                handleSave();
              }}
              disabled={saving || finalizing || loading}
            >
              Finalizar
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
                {productSearching || supplierProductsLoading
                  ? 'Buscando…'
                  : 'No hay resultados. Prueba con referencia, nombre o ID.'}
              </div>
              {productQuery.trim().length >= 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewProductName(productQuery.trim());
                    setNewProductCode('');
                    setProductDialogOpen(false);
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
              const metaParts = [
                p.code ? `Ref. ${p.code}` : null,
                p.productGroupName ? `Grupo ${p.productGroupName}` : null,
                p.measurementUnit ? `Unidad ${p.measurementUnit}` : null,
                `ID ${p.idProduct}`,
              ].filter(Boolean);
              return (
                <CommandItem
                  key={p.idProduct}
                  value={[label, p.productGroupName, p.measurementUnit, p.idProduct].filter(Boolean).join(' ')}
                  onSelect={() => addProduct(p)}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{label}</div>
                      <div className="truncate text-xs text-muted-foreground">{metaParts.join(' · ')}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {p.matchLabel ? <div>{p.matchLabel}</div> : null}
                      <div>{p.price ?? 0}</div>
                    </div>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
        <div className="border-t p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const q = productQuery.trim();
                if (q.length > 0) {
                  setNewProductName(q);
                  setNewProductCode('');
                }
                setProductDialogOpen(false);
                setCreateProductOpen(true);
              }}
            >
              {productQuery.trim().length > 0 ? `Crear producto: “${productQuery.trim()}”` : 'Crear producto'}
            </Button>
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
          </div>
          <div className="text-[11px] text-muted-foreground">
            Si no escribes nada, muestra una lista base desde el catálogo precargado. Si filtras por proveedor, limita esa lista al historial de compras del proveedor.
          </div>
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
            <DialogDescription>
              Aquí solo se capturan los datos mínimos. Costos, IVA, fletes, descuentos y margen se toman de la línea del documento al guardar/finalizar.
            </DialogDescription>
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
              <div className="md:col-span-2 grid gap-2">
                <Label>Opciones</Label>
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
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateProductOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreateProduct}>
              Agregar al documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
