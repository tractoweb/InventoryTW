/**
 * Servicio de Inventario
 * Gestiona operaciones de productos, stocks y alertas
 */

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { listAllPages } from '@/services/amplify-list-all';

function normalizeForSearch(value: unknown): string {
  // - trim/collapse whitespace
  // - remove diacritics
  // - uppercase
  // - keep letters/numbers only (so codes like 60/28-KOYO are searchable)
  const raw = String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

  return raw.replace(/[^0-9A-Z]+/g, '');
}

function tokenizeQuery(value: string): string[] {
  const raw = String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase();

  // Split by any non-alphanumeric; keep only meaningful tokens.
  return raw
    .split(/[^0-9A-Z]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/**
 * Obtiene información completa de un producto
 */
export async function getProductDetails(productId: string): Promise<{
  success: boolean;
  // Canonical structured payload (safe to send to Client Components)
  product?: {
    idProduct: number;
    name: string;
    code?: string | null;
    plu?: number | null;
    measurementUnit?: string | null;
    price?: number | null;
    isTaxInclusivePrice?: boolean | null;
    currencyId?: number | null;
    isPriceChangeAllowed?: boolean | null;
    isService?: boolean | null;
    isUsingDefaultQuantity?: boolean | null;
    isEnabled?: boolean | null;
    description?: string | null;
    cost?: number | null;
    markup?: number | null;
    image?: string | null;
    color?: string | null;
    ageRestriction?: number | null;
    lastPurchasePrice?: number | null;
    rank?: number | null;
    productGroupId?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  barcodes?: Array<{ value: string; productId: number }>;
  taxes?: Array<{ taxId: number; name: string; rate: number; code?: string | null }>;
  stocks?: Array<{ warehouseId: number; warehouseName?: string | null; quantity: number }>;
  stockControls?: Array<any>;
  // Back-compat flattened fields used by existing UI
  id?: number;
  name?: string;
  code?: string | null;
  description?: string | null;
  productgroupid?: number | null;
  productgroupname?: string | null;
  currencyid?: number | null;
  currencyname?: string | null;
  currencycode?: string | null;
  measurementunit?: string | null;
  price?: number | null;
  cost?: number | null;
  markup?: number | null;
  lastpurchaseprice?: number | null;
  isenabled?: boolean | null;
  istaxinclusiveprice?: boolean | null;
  barcodesText?: string;
  taxesText?: string;
  totalstock?: number;
  stocklocations?: Array<{ warehousename: string; quantity: number }>;
  reorderpoint?: number;
  lowstockwarningquantity?: number;
  islowstockwarningenabled?: boolean;
  datecreated?: string | null;
  dateupdated?: string | null;
  error?: string;
}> {
  try {
    const product = await amplifyClient.models.Product.get({
      idProduct: Number(productId),
    } as any);

    if (!product.data) {
      return { success: false, error: 'Product not found' };
    }

    const productData = product.data as any;

    const productPlain = {
      idProduct: Number(productData?.idProduct ?? 0),
      name: String(productData?.name ?? ''),
      code: productData?.code ? String(productData.code) : null,
      plu: productData?.plu !== undefined && productData?.plu !== null ? Number(productData.plu) : null,
      measurementUnit: productData?.measurementUnit ? String(productData.measurementUnit) : null,
      price: productData?.price !== undefined && productData?.price !== null ? Number(productData.price) : null,
      isTaxInclusivePrice:
        productData?.isTaxInclusivePrice !== undefined && productData?.isTaxInclusivePrice !== null
          ? Boolean(productData.isTaxInclusivePrice)
          : null,
      currencyId: productData?.currencyId !== undefined && productData?.currencyId !== null ? Number(productData.currencyId) : null,
      isPriceChangeAllowed:
        productData?.isPriceChangeAllowed !== undefined && productData?.isPriceChangeAllowed !== null
          ? Boolean(productData.isPriceChangeAllowed)
          : null,
      isService: productData?.isService !== undefined && productData?.isService !== null ? Boolean(productData.isService) : null,
      isUsingDefaultQuantity:
        productData?.isUsingDefaultQuantity !== undefined && productData?.isUsingDefaultQuantity !== null
          ? Boolean(productData.isUsingDefaultQuantity)
          : null,
      isEnabled: productData?.isEnabled !== undefined && productData?.isEnabled !== null ? Boolean(productData.isEnabled) : null,
      description: productData?.description ? String(productData.description) : null,
      cost: productData?.cost !== undefined && productData?.cost !== null ? Number(productData.cost) : null,
      markup: productData?.markup !== undefined && productData?.markup !== null ? Number(productData.markup) : null,
      image: productData?.image ? String(productData.image) : null,
      color: productData?.color ? String(productData.color) : null,
      ageRestriction:
        productData?.ageRestriction !== undefined && productData?.ageRestriction !== null ? Number(productData.ageRestriction) : null,
      lastPurchasePrice:
        productData?.lastPurchasePrice !== undefined && productData?.lastPurchasePrice !== null
          ? Number(productData.lastPurchasePrice)
          : null,
      rank: productData?.rank !== undefined && productData?.rank !== null ? Number(productData.rank) : null,
      productGroupId:
        productData?.productGroupId !== undefined && productData?.productGroupId !== null ? Number(productData.productGroupId) : null,
      createdAt: productData?.createdAt ? String(productData.createdAt) : null,
      updatedAt: productData?.updatedAt ? String(productData.updatedAt) : null,
    };

    const [barcodesRes, productTaxesRes, stocksRes, stockControlsRes] = await Promise.all([
      listAllPages<any>((args) => amplifyClient.models.Barcode.list(args), {
        filter: { productId: { eq: Number(productId) } },
      }),
      listAllPages<any>((args) => amplifyClient.models.ProductTax.list(args), {
        filter: { productId: { eq: Number(productId) } },
      }),
      listAllPages<any>((args) => amplifyClient.models.Stock.list(args), {
        filter: { productId: { eq: Number(productId) } },
      }),
      listAllPages<any>((args) => amplifyClient.models.StockControl.list(args), {
        filter: { productId: { eq: Number(productId) } },
      }),
    ]);

    const barcodes = (
      'error' in barcodesRes ? [] : (barcodesRes.data ?? [])
    )
      .map((b: any) => ({
        value: String(b?.value ?? ''),
        productId: Number(b?.productId ?? 0),
      }))
      .filter((b: any) => b.value.length > 0);
    const productTaxes = 'error' in productTaxesRes ? [] : (productTaxesRes.data ?? []);
    const rawStocks = 'error' in stocksRes ? [] : (stocksRes.data ?? []);
    const rawStockControls = 'error' in stockControlsRes ? [] : (stockControlsRes.data ?? []);

    const taxIds = Array.from(
      new Set(productTaxes.map((pt: any) => Number(pt?.taxId)).filter((id: any) => Number.isFinite(id)))
    ) as number[];
    const taxGets = await Promise.all(taxIds.map((idTax) => amplifyClient.models.Tax.get({ idTax } as any)));
    const taxes = taxGets
      .map((r: any) => r?.data)
      .filter(Boolean)
      .map((t: any) => ({
        taxId: Number(t.idTax),
        name: String(t.name ?? ''),
        rate: Number(t.rate ?? 0),
        code: t.code ? String(t.code) : null,
      }))
      .sort((a, b) => a.taxId - b.taxId);

    const warehouseIds = Array.from(
      new Set(rawStocks.map((s: any) => Number(s?.warehouseId)).filter((id: any) => Number.isFinite(id)))
    ) as number[];
    const warehouseGets = await Promise.all(
      warehouseIds.map((idWarehouse) => amplifyClient.models.Warehouse.get({ idWarehouse } as any))
    );
    const warehouseById = new Map<number, string>();
    for (let i = 0; i < warehouseIds.length; i++) {
      const w = (warehouseGets[i] as any)?.data;
      if (w) warehouseById.set(warehouseIds[i], String(w.name ?? w.idWarehouse));
    }

    const stocks = rawStocks
      .map((s: any) => {
        const wid = Number(s?.warehouseId);
        return {
          warehouseId: Number.isFinite(wid) ? wid : 0,
          warehouseName: warehouseById.get(wid) ?? null,
          quantity: Number(s?.quantity ?? 0) || 0,
        };
      })
      .filter((s: any) => s.warehouseId > 0)
      .sort((a: any, b: any) => a.warehouseId - b.warehouseId);

    const customerIds = Array.from(
      new Set(rawStockControls.map((sc: any) => Number(sc?.customerId)).filter((id: any) => Number.isFinite(id)))
    ) as number[];
    const customerGets = await Promise.all(customerIds.map((idCustomer) => amplifyClient.models.Customer.get({ idCustomer } as any)));
    const customerById = new Map<number, string>();
    for (let i = 0; i < customerIds.length; i++) {
      const c = (customerGets[i] as any)?.data;
      if (c) customerById.set(customerIds[i], String(c.name ?? c.idCustomer));
    }

    const stockControls = rawStockControls
      .map((sc: any) => {
        const cid = sc?.customerId !== undefined && sc?.customerId !== null ? Number(sc.customerId) : null;
        return {
          stockControlId: Number(sc?.stockControlId ?? 0),
          customerId: cid,
          customerName: cid ? (customerById.get(cid) ?? null) : null,
          reorderPoint: Number(sc?.reorderPoint ?? 0) || 0,
          preferredQuantity: Number(sc?.preferredQuantity ?? 0) || 0,
          isLowStockWarningEnabled: Boolean(sc?.isLowStockWarningEnabled ?? true),
          lowStockWarningQuantity: Number(sc?.lowStockWarningQuantity ?? 0) || 0,
        };
      })
      .sort((a: any, b: any) => Number(a.stockControlId) - Number(b.stockControlId));

    const totalstock = stocks.reduce((sum, s) => sum + (Number(s.quantity ?? 0) || 0), 0);
    const stocklocations = stocks.map((s) => ({ warehousename: String(s.warehouseName ?? `#${s.warehouseId}`), quantity: s.quantity }));

    const defaultStockControl = stockControls.find((sc: any) => sc.customerId === null) ?? stockControls[0] ?? null;

    let productgroupname: string | null = null;
    if (productPlain.productGroupId && Number.isFinite(productPlain.productGroupId)) {
      const groupRes: any = await amplifyClient.models.ProductGroup.get({ idProductGroup: Number(productPlain.productGroupId) } as any);
      if (groupRes?.data) productgroupname = String((groupRes.data as any)?.name ?? null);
    }

    let currencyname: string | null = null;
    let currencycode: string | null = null;
    if (productPlain.currencyId && Number.isFinite(productPlain.currencyId)) {
      const currencyRes: any = await amplifyClient.models.Currency.get({ idCurrency: Number(productPlain.currencyId) } as any);
      if (currencyRes?.data) {
        currencyname = String((currencyRes.data as any)?.name ?? null);
        currencycode = (currencyRes.data as any)?.code ? String((currencyRes.data as any).code) : null;
      }
    }

    return {
      success: true,
      product: productPlain,
      barcodes,
      taxes,
      stocks,
      stockControls,
      id: productPlain.idProduct,
      name: productPlain.name,
      code: productPlain.code,
      description: productPlain.description,
      productgroupid: productPlain.productGroupId ?? null,
      productgroupname,
      currencyid: productPlain.currencyId ?? null,
      currencyname,
      currencycode,
      measurementunit: productPlain.measurementUnit ?? null,
      price: productPlain.price ?? null,
      cost: productPlain.cost ?? null,
      markup: productPlain.markup ?? null,
      lastpurchaseprice: productPlain.lastPurchasePrice ?? null,
      isenabled: productPlain.isEnabled ?? null,
      istaxinclusiveprice: productPlain.isTaxInclusivePrice ?? null,
      barcodesText: barcodes.map((b) => b.value).join(', '),
      taxesText: taxes.map((t) => t.name).join(', '),
      totalstock,
      stocklocations,
      reorderpoint: Number(defaultStockControl?.reorderPoint ?? 0) || 0,
      lowstockwarningquantity: Number(defaultStockControl?.lowStockWarningQuantity ?? 0) || 0,
      islowstockwarningenabled: Boolean(defaultStockControl?.isLowStockWarningEnabled ?? true),
      datecreated: productPlain.createdAt ?? null,
      dateupdated: productPlain.updatedAt ?? null,
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Busca productos por nombre, código o barcode
 */
export async function searchProducts(
  query: string,
  limit: number = 50
): Promise<{
  success: boolean;
  products?: any[];
  error?: string;
}> {
  try {
    const normalized = String(query ?? '').trim();

    const isEnabledOk = (p: any) => p?.isEnabled !== false;

    const queryVariants = Array.from(
      new Set([normalized, normalized.toUpperCase(), normalized.toLowerCase()].filter((s) => s.length > 0))
    );

    // When query is empty, return a small list of products (for initial suggestions).
    // NOTE: we avoid filtering by isEnabled at query time because comparisons like `ne: false`
    // can exclude records where the attribute is missing, which is common after imports.
    if (normalized.length === 0) {
      const { data: products } = await amplifyClient.models.Product.list({
        limit,
      } as any);

      return { success: true, products: (products ?? []).filter(isEnabledOk).slice(0, limit) };
    }

    // Search by name/code.
    // We intentionally do two queries (name + code) because `or` filters are not always reliable
    // across different Amplify Data/GraphQL backends.
    const byId = new Map<number, any>();
    for (const q of queryVariants) {
      const [byName, byCode] = await Promise.all([
        amplifyClient.models.Product.list({ filter: { name: { contains: q } }, limit: Math.max(100, limit) } as any),
        amplifyClient.models.Product.list({ filter: { code: { contains: q } }, limit: Math.max(100, limit) } as any),
      ]);

      for (const p of (byName as any)?.data ?? []) {
        const id = Number((p as any)?.idProduct);
        if (Number.isFinite(id)) byId.set(id, p);
      }
      for (const p of (byCode as any)?.data ?? []) {
        const id = Number((p as any)?.idProduct);
        if (Number.isFinite(id)) byId.set(id, p);
      }
    }

    const merged = Array.from(byId.values()).filter(isEnabledOk);
    if (merged.length > 0) {
      return { success: true, products: merged.slice(0, limit) };
    }

    // If not found by name/code, search by barcode
    const barcodeMatches: any[] = [];
    for (const q of queryVariants) {
      const { data } = await amplifyClient.models.Barcode.list({ filter: { value: { contains: q } }, limit: 200 } as any);
      if (data?.length) barcodeMatches.push(...data);
    }

    if (barcodeMatches.length > 0) {
      const productIds = Array.from(
        new Set(barcodeMatches.map((b) => Number((b as any)?.productId)).filter((id) => Number.isFinite(id)))
      );

      const productsFromBarcodeArr: any[] = [];
      for (const id of productIds) {
        const { data: prod } = await amplifyClient.models.Product.get({ idProduct: Number(id) } as any);
        if (prod && isEnabledOk(prod)) productsFromBarcodeArr.push(prod);
        if (productsFromBarcodeArr.length >= limit) break;
      }

      return { success: true, products: productsFromBarcodeArr.slice(0, limit) };
    }

    // Fallback: robust in-memory matching to handle special chars, accents, multiple spaces, etc.
    // This is only used when the backend filters returned nothing.
    const tokens = tokenizeQuery(normalized);
    const normalizedKey = normalizeForSearch(normalized);
    const all = await listAllPages<any>((args) => amplifyClient.models.Product.list(args));
    if ('error' in all) {
      return { success: false, error: all.error };
    }

    const scored: Array<{ p: any; score: number }> = [];
    for (const p of all.data) {
      if (!isEnabledOk(p)) continue;

      const nameKey = normalizeForSearch((p as any)?.name);
      const codeKey = normalizeForSearch((p as any)?.code);
      const hay = `${nameKey} ${codeKey}`;

      // Token match (all tokens must appear in either name or code normalized string)
      const tokenOk = tokens.length === 0 || tokens.every((t) => hay.includes(normalizeForSearch(t)));
      if (!tokenOk) continue;

      // Prefer exact code match, then prefix matches, then substring matches
      let score = 0;
      if (normalizedKey && codeKey === normalizedKey) score += 100;
      if (normalizedKey && nameKey === normalizedKey) score += 80;
      if (normalizedKey && codeKey.startsWith(normalizedKey)) score += 60;
      if (normalizedKey && nameKey.startsWith(normalizedKey)) score += 40;
      if (normalizedKey && hay.includes(normalizedKey)) score += 10;
      if (score === 0) score = 1;

      scored.push({ p, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return { success: true, products: scored.slice(0, limit).map((s) => s.p) };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Obtiene alertas de stock bajo
 */
export async function getLowStockAlerts(): Promise<{
  success: boolean;
  alerts?: {
    productId: string;
    productName: string;
    currentStock: number;
    warningQuantity: number;
    warehouseName: string;
  }[];
  error?: string;
}> {
  try {
    // Obtener todos los stock controls habilitados
    const { data: controls } = await amplifyClient.models.StockControl.list({
      filter: {
        isLowStockWarningEnabled: { eq: true },
      },
    });

    if (!controls || controls.length === 0) {
      return { success: true, alerts: [] };
    }

    const alerts: any[] = [];

    for (const control of controls) {
      // Obtener stocks del producto
      const { data: stocks } = await amplifyClient.models.Stock.list({
        filter: {
          productId: { eq: control.productId },
        },
      });

      const totalStock = stocks?.reduce((sum, s) => sum + (s.quantity || 0), 0) || 0;

      // Si stock es menor al mínimo, agregar alerta
      if (totalStock <= (control.lowStockWarningQuantity || 0)) {
        alerts.push({
          productId: control.productId,
          productName: control.product?.name || 'Unknown',
          currentStock: totalStock,
          warningQuantity: control.lowStockWarningQuantity,
          warehouseName: stocks?.[0]?.warehouse?.name || 'Unknown',
        });
      }
    }

    return { success: true, alerts };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Obtiene resumen de inventario por almacén
 */
export async function getInventorySummary(warehouseId?: string): Promise<{
  success: boolean;
  summary?: {
    totalProducts: number;
    totalUnits: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  error?: string;
}> {
  try {
    const normalizedWarehouseId = warehouseId === undefined ? undefined : Number(warehouseId);
    const stockFilter = normalizedWarehouseId ? { warehouseId: { eq: normalizedWarehouseId } } : undefined;
    const { data: stocks } = await amplifyClient.models.Stock.list({
      filter: stockFilter as any,
    });

    const { data: controls } = await amplifyClient.models.StockControl.list({
      filter: {
        isLowStockWarningEnabled: { eq: true },
      },
    });

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalUnits = 0;
    let totalValue = 0;

    stocks?.forEach((stock) => {
      totalUnits += stock.quantity || 0;

      const productRecord = (stock as any)?.product;
      const cost = typeof productRecord === 'object' && productRecord ? Number(productRecord.cost ?? 0) : 0;
      totalValue += (stock.quantity || 0) * cost;

      // Contar bajo stock
      const control = controls?.find((c) => c.productId === stock.productId);
      if (control && (stock.quantity || 0) <= (control.lowStockWarningQuantity || 0)) {
        lowStockCount++;
      }

      // Contar sin stock
      if (!stock.quantity || stock.quantity === 0) {
        outOfStockCount++;
      }
    });

    return {
      success: true,
      summary: {
        totalProducts: stocks?.length || 0,
        totalUnits,
        totalValue,
        lowStockCount,
        outOfStockCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Crea o actualiza un ajuste de stock
 */
export async function adjustStock(
  productId: string,
  warehouseId: string,
  newQuantity: number,
  reason: string,
  userId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const normalizedProductId = Number(productId);
    const normalizedWarehouseId = Number(warehouseId);
    const normalizedUserId = Number(userId);

    // Obtener stock actual
    const { data: stocks } = await amplifyClient.models.Stock.list({
      filter: {
        productId: { eq: normalizedProductId },
        warehouseId: { eq: normalizedWarehouseId },
      },
    });

    const stock = stocks?.[0];
    const currentQuantity = stock?.quantity || 0;
    const difference = newQuantity - currentQuantity;

    // Actualizar stock
    if (stock) {
      await amplifyClient.models.Stock.update({
        productId: (stock as any).productId,
        warehouseId: (stock as any).warehouseId,
        quantity: newQuantity,
      });
    } else {
      await amplifyClient.models.Stock.create({
        productId: normalizedProductId,
        warehouseId: normalizedWarehouseId,
        quantity: newQuantity,
      });
    }

    // Crear entrada en Kardex para auditoría
    const { createKardexEntry } = await import('./kardex-service');
    await createKardexEntry({
      productId: normalizedProductId,
      date: new Date(),
      type: 'AJUSTE',
      quantity: difference,
      balance: newQuantity,
      note: reason,
      userId: normalizedUserId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

// Export all inventory-related functions as inventoryService for compatibility
export const inventoryService = {
  getProductDetails,
  searchProducts,
  getLowStockAlerts,
  getInventorySummary,
  adjustStock,
};
