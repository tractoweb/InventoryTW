/**
 * Servicio de Documentos - FIXED
 * Gestiona la creación, actualización y finalización de documentos
 * Automáticamente genera números y actualiza Ksdsdsssardex
 */

import { amplifyClient, DOCUMENT_STOCK_DIRECTION, formatAmplifyError, isStockDirectionIn, isStockDirectionOut } from '@/lib/amplify-config';
import { getBogotaYearMonth } from '@/lib/datetime';
import { createKardexEntry } from './kardex-service';

function looksLikeUnknownInputFieldError(message: string | undefined): boolean {
  const msg = String(message ?? '').toLowerCase();
  return (
    msg.includes('not defined for input object type') ||
    msg.includes('unknown field') ||
    msg.includes('field') && msg.includes('not defined')
  );
}

export interface DocumentCreateRequest {
  documentId: number;
  userId: number;
  /** Supplier ID (legacy Customer model). Used mainly for purchase documents. */
  customerId?: number;
  /** Sales client ID (new Client model). Optional. */
  clientId?: number;
  /** Free-text client name snapshot for traceability (e.g. POS). */
  clientNameSnapshot?: string;
  orderNumber?: string;
  documentTypeId: number;
  warehouseId: number;
  date: Date;
  dueDate?: Date;
  /** 0=pending/unpaid, 1=partial, 2=paid */
  paidStatus?: number;
  idempotencyKey?: string;
  referenceDocumentNumber?: string;
  note?: string;
  internalNote?: string;
  discount?: number;
  discountType?: number;
  discountApplyRule?: number;
  serviceType?: number;
  items: DocumentItemInput[];
}

export interface DocumentItemInput {
  documentItemId: number;
  productId: number;
  quantity: number;
  price: number;
  discount?: number;
  discountType?: number;
  taxIds?: number[];
  /** Optional unit cost to store on DocumentItem.productCost and use in Kardex. */
  productCost?: number;
}

/**
 * Genera el próximo número de documento
 */
export async function generateDocumentNumber(
  documentTypeId: number,
  warehouseId: number
): Promise<{
  success: boolean;
  number?: string;
  error?: string;
}> {
  try {
    const { year, month } = getBogotaYearMonth(new Date());

    // Buscar o crear registro de número
    const { data: existing } = await amplifyClient.models.DocumentNumber.list({
      filter: {
        documentTypeId: { eq: Number(documentTypeId) },
        warehouseId: { eq: Number(warehouseId) },
        year: { eq: year },
        month: { eq: month },
      },
    });

    let counter = existing?.[0] as any;

    if (!counter) {
      // Crear nuevo contador
      const result = await amplifyClient.models.DocumentNumber.create({
        documentTypeId: Number(documentTypeId),
        warehouseId: Number(warehouseId),
        year,
        month,
        sequence: 1,
        lastNumber: 1,
      });
      counter = result.data as any;
    } else {
      // Incrementar secuencia
      counter = (
        await amplifyClient.models.DocumentNumber.update({
          documentTypeId: Number(documentTypeId),
          warehouseId: Number(warehouseId),
          year,
          month,
          sequence: ((counter as any).sequence || 0) + 1,
          lastNumber: ((counter as any).lastNumber || 0) + 1,
        })
      ).data as any;
    }

    if (!counter) {
      return { success: false, error: 'Failed to generate document number' };
    }

    // Formato: YEAR-TYPE-SEQUENCE (ej: 2025-100-000042)
    const documentType = await amplifyClient.models.DocumentType.get({
      documentTypeId: Number(documentTypeId),
    });

    const type = (documentType.data as any)?.code || '000';
    const sequence = (counter as any)?.sequence || 0;
    const number = `${year}-${type}-${String(sequence).padStart(6, '0')}`;

    return { success: true, number };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Crea un documento con sus items
 */
export async function createDocument(
  input: DocumentCreateRequest
): Promise<{
  success: boolean;
  documentId?: string;
  documentNumber?: string;
  error?: string;
}> {
  try {
    // Generar número de documento
    const { success: genSuccess, number } = await generateDocumentNumber(
      Number(input.documentTypeId),
      Number(input.warehouseId)
    );

    if (!genSuccess || !number) {
      return { success: false, error: 'Failed to generate document number' };
    }

    // Obtener tipo de documento para conocer dirección de stock
    const docType = await amplifyClient.models.DocumentType.get({
      documentTypeId: Number(input.documentTypeId)
    });

    const stockDirection = (docType.data as any)?.stockDirection ?? DOCUMENT_STOCK_DIRECTION.NONE;

    // In this app, POS sales show prices with IVA included. Purchase creation UI can optionally include IVA
    // (liquidation config). Default to IVA-included to keep totals aligned with what the user sees.
    const pricesIncludeTax = (() => {
      if (stockDirection === DOCUMENT_STOCK_DIRECTION.OUT) return true;
      if (stockDirection === DOCUMENT_STOCK_DIRECTION.IN) {
        const raw = input.internalNote;
        if (typeof raw === 'string' && raw.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(raw);
            const v = parsed?.liquidation?.config?.ivaIncludedInCost;
            if (typeof v === 'boolean') return v;
          } catch {
            // ignore
          }
        }
        return true;
      }
      return true;
    })();

    // Calcular total del documento
    let total = 0;
    for (const item of input.items) {
      const itemTotal = item.quantity * item.price;
      total += itemTotal;
    }

    // Aplicar descuento si existe
    if (input.discount && input.discount > 0) {
      total = input.discountType === 0 ? total - input.discount : total * (1 - input.discount / 100);
    }

    // Validar que documentId esté presente
    if (typeof input.documentId !== 'number' || isNaN(input.documentId)) {
      return { success: false, error: 'documentId es obligatorio y debe ser un número único.' };
    }
    const docPayload: any = {
      documentId: input.documentId,
      number: number,
      userId: Number(input.userId),
      customerId: input.customerId !== undefined ? Number(input.customerId) : undefined,
      clientId: input.clientId !== undefined ? Number(input.clientId) : undefined,
      clientNameSnapshot: input.clientNameSnapshot !== undefined ? String(input.clientNameSnapshot) : undefined,
      orderNumber: input.orderNumber,
      date: input.date.toISOString().split('T')[0], // Solo fecha
      // `stockDate` should represent when inventory was posted (finalized), not the selected document date.
      // It will be overwritten on finalize; keep a sensible default for drafts.
      stockDate: new Date().toISOString(),
      documentTypeId: Number(input.documentTypeId),
      warehouseId: Number(input.warehouseId),
      total: total,
      dueDate: input.dueDate?.toISOString().split('T')[0],
      idempotencyKey: input.idempotencyKey,
      referenceDocumentNumber: input.referenceDocumentNumber,
      note: input.note,
      internalNote: input.internalNote,
      discount: input.discount || 0,
      discountType: input.discountType || 0,
      discountApplyRule: input.discountApplyRule || 0,
      serviceType: input.serviceType || 0,
      isClockedOut: false,
      paidStatus: Number.isFinite(Number(input.paidStatus)) ? Number(input.paidStatus) : 0,
    };

    let docResult: any = await amplifyClient.models.Document.create(docPayload);

    if (!(docResult as any).data) {
      const msg = ((docResult as any)?.errors?.[0]?.message as string | undefined) ?? 'Failed to create document';

      // Backwards compatibility: older backend schemas may not yet expose newer optional fields.
      if (looksLikeUnknownInputFieldError(msg)) {
        const fallback = { ...docPayload } as any;
        delete fallback.idempotencyKey;
        delete fallback.clientId;
        delete fallback.clientNameSnapshot;
        docResult = await amplifyClient.models.Document.create(fallback as any);
      }
    }

    if (!(docResult as any).data) {
      const msg = ((docResult as any)?.errors?.[0]?.message as string | undefined) ?? 'Failed to create document';
      return { success: false, error: msg };
    }

    // Crear items del documento
    let itemIndex = 0;
    for (const item of input.items) {
      // Obtener producto para información de costo
      const product = await amplifyClient.models.Product.get({
        idProduct: Number(item.productId)
      });

      const productData = (product as any)?.data as any;
      const productNameSnapshot = typeof productData?.name === 'string' ? productData.name : undefined;
      const productCodeSnapshot = typeof productData?.code === 'string' ? productData.code : undefined;
      const measurementUnitSnapshot = typeof productData?.measurementUnit === 'string' ? productData.measurementUnit : undefined;

      // Best-effort barcode snapshot (optional)
      let barcodeSnapshot: string | undefined;
      try {
        const { data } = (await amplifyClient.models.Barcode.list({
          filter: { productId: { eq: Number(item.productId) } },
          limit: 1,
        } as any)) as any;
        const first = Array.isArray(data) ? data[0] : null;
        if (first?.value) barcodeSnapshot = String(first.value);
      } catch {
        // ignore
      }

      const itemPrice = item.price;
      const itemTotal = item.quantity * itemPrice;
      let lineAmountAfterDiscount = itemTotal;

      if (item.discount && item.discount > 0) {
        lineAmountAfterDiscount =
          item.discountType === 0
            ? itemTotal - item.discount
            : itemTotal * (1 - item.discount / 100);
      }

      // Resolve applicable taxes.
      let taxIds: number[] = Array.isArray(item.taxIds) ? item.taxIds.map((t) => Number(t)) : [];
      taxIds = taxIds.filter((t) => Number.isFinite(t) && t > 0);

      if (taxIds.length === 0) {
        try {
          const { data } = (await amplifyClient.models.ProductTax.list({
            filter: { productId: { eq: Number(item.productId) } },
            limit: 50,
          } as any)) as any;
          taxIds = Array.from(
            new Set(
              (Array.isArray(data) ? data : [])
                .map((pt: any) => Number(pt?.taxId))
                .filter((id: any) => Number.isFinite(id) && id > 0)
            )
          );
        } catch {
          taxIds = [];
        }
      }

      const taxRows: Array<{ taxId: number; rate: number; isFixed: boolean }> = [];
      for (const taxId of taxIds) {
        try {
          const tax = await amplifyClient.models.Tax.get({ idTax: Number(taxId) } as any);
          const taxData = (tax as any)?.data as any;
          if (!taxData) continue;
          if (taxData?.isEnabled === false) continue;
          const rate = Number(taxData?.rate ?? 0) || 0;
          const isFixed = Boolean(taxData?.isFixed);
          if (!Number.isFinite(rate) || rate <= 0) continue;
          taxRows.push({ taxId: Number(taxId), rate, isFixed });
        } catch {
          // ignore tax resolution errors
        }
      }

      const percentTaxes = taxRows.filter((t) => !t.isFixed && t.rate > 0);
      const rateSum = percentTaxes.reduce((acc, t) => acc + t.rate, 0);
      const divisor = 1 + rateSum / 100;

      const grossAfterDiscount = lineAmountAfterDiscount;
      const netAfterDiscount = pricesIncludeTax && divisor > 0 ? grossAfterDiscount / divisor : grossAfterDiscount;

      const unitNet = pricesIncludeTax && divisor > 0 ? itemPrice / divisor : itemPrice;

      const itemPayload: any = {
        documentItemId: item.documentItemId,
        documentId: (docResult.data as any).documentId,
        productId: Number(item.productId),
        productNameSnapshot,
        productCodeSnapshot,
        measurementUnitSnapshot,
        barcodeSnapshot,
        quantity: item.quantity,
        expectedQuantity: item.quantity,
        price: itemPrice,
        priceBeforeTax: unitNet,
        discount: item.discount || 0,
        discountType: item.discountType || 0,
        productCost: Number.isFinite(Number(item.productCost)) ? Number(item.productCost) : productData?.cost || 0,
        priceBeforeTaxAfterDiscount: netAfterDiscount,
        priceAfterDiscount: grossAfterDiscount,
        total: itemTotal,
        totalAfterDocumentDiscount: grossAfterDiscount,
        discountApplyRule: 0,
      };

      let itemResult: any = await amplifyClient.models.DocumentItem.create(itemPayload);

      if (!(itemResult as any)?.data) {
        const msg = ((itemResult as any)?.errors?.[0]?.message as string | undefined) ?? 'Failed to create document item';
        // Backwards compatibility: older backend schemas may not include snapshot fields yet.
        if (looksLikeUnknownInputFieldError(msg)) {
          const {
            productNameSnapshot,
            productCodeSnapshot,
            measurementUnitSnapshot,
            barcodeSnapshot,
            ...fallback
          } = itemPayload;
          itemResult = await amplifyClient.models.DocumentItem.create(fallback as any);
        }
      }

      if (!(itemResult as any)?.data) {
        const msg = ((itemResult as any)?.errors?.[0]?.message as string | undefined) ?? 'Failed to create document item';
        return { success: false, error: `${msg} (productId: ${item.productId})` };
      }

      itemIndex++;

      // Crear registros de impuestos (IVA) para trazabilidad y reportes.
      // If prices include tax, compute the tax portion from gross; otherwise, compute from net.
      if (percentTaxes.length && rateSum > 0) {
        const gross = grossAfterDiscount;
        const net = pricesIncludeTax && divisor > 0 ? gross / divisor : gross;
        const totalTax = pricesIncludeTax ? gross - net : (net * rateSum) / 100;

        for (const t of percentTaxes) {
          const amount = pricesIncludeTax
            ? (totalTax * t.rate) / rateSum
            : (net * t.rate) / 100;

          if (!amount) continue;

          await amplifyClient.models.DocumentItemTax.create({
            documentItemId: (itemResult.data as any)?.documentItemId || '',
            taxId: Number(t.taxId),
            amount,
          });
        }
      }
    }

    return {
      success: true,
      documentId: String((docResult.data as any)?.documentId ?? input.documentId),
      documentNumber: number,
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}



/**
 * Finaliza un documento y actualiza stocks + kardex
 */
export async function finalizeDocument(
  documentId: number,
  userId: string,
  options?: {
    clampNegativeStockToZero?: boolean;
    forceAllowNegativeStock?: boolean;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Obtener documento
    const doc = await amplifyClient.models.Document.get({
      documentId: Number(documentId)
    });

    if (!doc.data) {
      return { success: false, error: 'Document not found' };
    }

    const docData = doc.data as any;

    // Ensure stockDate reflects the actual posting moment.
    // This prevents ambiguous ordering (many docs at 00:00) and makes Kardex/Stock timelines consistent.
    const postingDateIso = new Date().toISOString();

    // Idempotency: avoid double-posting stock/kardex.
    if (docData?.isClockedOut === true) {
      return { success: true };
    }

    // Best-effort: persist posting time on the document before posting movements.
    try {
      await amplifyClient.models.Document.update({
        documentId: Number(documentId),
        stockDate: postingDateIso,
      } as any);
      docData.stockDate = postingDateIso;
    } catch {
      // ignore
      docData.stockDate = postingDateIso;
    }

    // Obtener tipo de documento
    const docType = await amplifyClient.models.DocumentType.get({
      documentTypeId: docData.documentTypeId
    });

    const stockDirection = (docType.data as any)?.stockDirection || DOCUMENT_STOCK_DIRECTION.NONE;

    if (!isStockDirectionIn(stockDirection) && !isStockDirectionOut(stockDirection)) {
      // No afecta stock, but still finalize the document.
      await amplifyClient.models.Document.update({
        documentId: Number(documentId),
        isClockedOut: true,
      });

      return { success: true };
    }

    // Cargar items del documento (no confiar en `doc.data.items` porque Amplify no los incluye por defecto)
    const allItems: any[] = [];
    let nextToken: string | null | undefined = undefined;
    do {
      const page: any = await amplifyClient.models.DocumentItem.list({
        filter: { documentId: { eq: Number(documentId) } },
        limit: 100,
        nextToken,
      } as any);
      if (page.data) allItems.push(...(page.data as any[]));
      nextToken = (page as any).nextToken;
    } while (nextToken);

    // Settings: allow negative stock (best-effort; default to allow to preserve current behavior)
    let allowNegativeStock = true;
    try {
      const companies: any = await amplifyClient.models.Company.list({ limit: 1 } as any);
      const companyId = Number((companies?.data?.[0] as any)?.idCompany ?? 1);
      const settings: any = await amplifyClient.models.ApplicationSettings.get({ companyId } as any);
      if (settings?.data && (settings.data as any).allowNegativeStock !== undefined && (settings.data as any).allowNegativeStock !== null) {
        allowNegativeStock = Boolean((settings.data as any).allowNegativeStock);
      }
    } catch {
      // ignore
    }

    if (options?.forceAllowNegativeStock) {
      allowNegativeStock = true;
    }

    // Load product flags once (we skip inventory posting for service products)
    const uniqueProductIds = Array.from(
      new Set(allItems.map((i) => Number(i?.productId)).filter((id) => Number.isFinite(id) && id > 0))
    ) as number[];

    const productGets = await Promise.all(
      uniqueProductIds.map((idProduct) => amplifyClient.models.Product.get({ idProduct } as any))
    );

    const productById = new Map<number, any>();
    for (let i = 0; i < uniqueProductIds.length; i++) {
      const p = (productGets[i] as any)?.data;
      if (p) productById.set(uniqueProductIds[i], p);
    }

    const lastEntradaCostCache = new Map<string, number>();
    async function getLastEntradaUnitCostFromKardex(args: { productId: number; warehouseId?: number | null }): Promise<number> {
      const pid = Number(args.productId);
      const wid = args.warehouseId !== undefined && args.warehouseId !== null ? Number(args.warehouseId) : null;
      const key = `${pid}:${wid ?? 0}`;

      if (!Number.isFinite(pid) || pid <= 0) return 0;
      if (lastEntradaCostCache.has(key)) return lastEntradaCostCache.get(key) ?? 0;

      try {
        const and: any[] = [{ productId: { eq: pid } }, { type: { eq: 'ENTRADA' } }];
        if (wid && Number.isFinite(wid)) and.push({ warehouseId: { eq: wid } });
        const filter = and.length === 1 ? and[0] : { and };

        const res: any = await amplifyClient.models.Kardex.list({
          filter,
          limit: 200,
        } as any);

        const rows: any[] = (res?.data ?? []) as any[];
        if (rows.length === 0) {
          lastEntradaCostCache.set(key, 0);
          return 0;
        }

        const best = rows
          .map((k) => {
            const dateMs = new Date(String(k?.date ?? '')).getTime();
            return {
              dateMs: Number.isFinite(dateMs) ? dateMs : 0,
              kardexId: Number(k?.kardexId ?? 0) || 0,
              unitCost: Number(k?.unitCost ?? 0) || 0,
              totalCost: Number(k?.totalCost ?? 0) || 0,
              quantity: Number(k?.quantity ?? 0) || 0,
            };
          })
          .sort((a, b) => (b.dateMs - a.dateMs) || (b.kardexId - a.kardexId))[0];

        let unitCost = 0;
        if (best) {
          if (best.unitCost > 0) unitCost = best.unitCost;
          else if (best.totalCost > 0 && best.quantity > 0) unitCost = best.totalCost / best.quantity;
        }

        lastEntradaCostCache.set(key, unitCost > 0 && Number.isFinite(unitCost) ? unitCost : 0);
        return lastEntradaCostCache.get(key) ?? 0;
      } catch {
        lastEntradaCostCache.set(key, 0);
        return 0;
      }
    }

    // Pre-validate stock updates to avoid partial posting.
    // We validate per (productId, warehouseId) for this document warehouse.
    const inventoryItems = allItems
      .filter((it) => {
        const pid = Number(it?.productId);
        if (!Number.isFinite(pid) || pid <= 0) return false;
        const product = productById.get(pid);
        return product?.isService !== true;
      })
      .map((it) => ({
        productId: Number(it?.productId),
        quantity: Number(it?.quantity ?? 0) || 0,
      }));

    const clampNegativeStockToZero = Boolean(options?.clampNegativeStockToZero);

    if (!allowNegativeStock && isStockDirectionOut(stockDirection) && !clampNegativeStockToZero) {
      const productIdsToCheck = Array.from(new Set(inventoryItems.map((i) => i.productId)));
      const warehouseId = Number(docData.warehouseId);

      // IMPORTANT: Use Stock.get for composite-key reads.
      // We have seen Stock.list(filters) return empty/incorrect results intermittently.
      const stockGets = await Promise.all(
        productIdsToCheck.map((pid) => amplifyClient.models.Stock.get({ productId: pid, warehouseId } as any).catch(() => null))
      );

      const currentByProduct = new Map<number, number>();
      for (let i = 0; i < productIdsToCheck.length; i++) {
        const row: any = (stockGets[i] as any)?.data;
        const qty = row?.quantity !== undefined && row?.quantity !== null ? Number(row.quantity) : 0;
        currentByProduct.set(productIdsToCheck[i], Number.isFinite(qty) ? qty : 0);
      }

      const deltaByProduct = new Map<number, number>();
      for (const it of inventoryItems) {
        const delta = -Math.abs(Number(it.quantity) || 0);
        deltaByProduct.set(it.productId, (deltaByProduct.get(it.productId) ?? 0) + delta);
      }

      for (const pid of productIdsToCheck) {
        const current = currentByProduct.get(pid) ?? 0;
        const next = current + (deltaByProduct.get(pid) ?? 0);
        if (next < 0) {
          const p = productById.get(pid);
          const name = String(p?.name ?? pid);
          const code = p?.code ? String(p.code) : '';
          return {
            success: false,
            error: `Stock insuficiente para ${name}${code ? ` (${code})` : ''} en la bodega. Stock actual: ${current}, requerido: ${Math.abs(
              deltaByProduct.get(pid) ?? 0
            )}`,
          };
        }
      }
    }

    for (const item of allItems) {
      const product = productById.get(Number(item?.productId));
      if (product?.isService === true) {
        continue;
      }

      // Obtener stock actual
      const { data: stock } = await amplifyClient.models.Stock.get({
        productId: Number(item.productId),
        warehouseId: Number(docData.warehouseId),
      } as any);
      const currentQuantity = stock?.quantity || 0;

      const requestedQuantity = Number(item?.quantity ?? 0) || 0;

      // When clamping is enabled (used by void flow in test data), avoid negative stock.
      // We post at most the available stock for SALIDA.
      const postedQuantity = isStockDirectionOut(stockDirection) && clampNegativeStockToZero
        ? Math.max(0, Math.min(requestedQuantity, Number(currentQuantity) || 0))
        : requestedQuantity;

      if (!(postedQuantity > 0)) {
        continue;
      }

      // Calcular nueva cantidad
      const quantityChange = isStockDirectionIn(stockDirection) ? postedQuantity : -postedQuantity;
      const newQuantity = currentQuantity + quantityChange;

      // Determine effective cost to record ("último costo")
      const rawItemCost = Number(item?.productCost ?? 0) || 0;
      const productLastPurchase = Number(product?.lastPurchasePrice ?? 0) || 0;
      const productCost = Number(product?.cost ?? 0) || 0;
      let effectiveUnitCost =
        stockDirection === DOCUMENT_STOCK_DIRECTION.IN
          ? (rawItemCost > 0 ? rawItemCost : productCost)
          : (rawItemCost > 0 ? rawItemCost : (productLastPurchase > 0 ? productLastPurchase : productCost));

      // Fallback: if SALIDA has no cost info, try last Kardex ENTRADA cost (per product + warehouse)
      if (isStockDirectionOut(stockDirection) && (!(effectiveUnitCost > 0) || !Number.isFinite(effectiveUnitCost))) {
        const fallback = await getLastEntradaUnitCostFromKardex({
          productId: Number(item.productId),
          warehouseId: Number(docData.warehouseId),
        });
        if (fallback > 0 && Number.isFinite(fallback)) {
          effectiveUnitCost = fallback;
        }
      }

      // Actualizar o crear stock
      if (stock) {
        await amplifyClient.models.Stock.update({
          productId: stock.productId,
          warehouseId: stock.warehouseId,
          quantity: newQuantity,
        });
      } else {
        await amplifyClient.models.Stock.create({
          productId: item.productId,
          warehouseId: docData.warehouseId,
          quantity: newQuantity,
        });
      }

      // Keep DocumentItem.productCost consistent with the cost we used for posting (helps later reports)
      if (effectiveUnitCost > 0 && Number.isFinite(Number(item?.documentItemId)) && Number(item?.documentItemId) > 0) {
        await amplifyClient.models.DocumentItem.update({
          documentItemId: Number(item.documentItemId),
          productCost: effectiveUnitCost,
        } as any);
      }

      // If it's an ENTRADA, update lastPurchasePrice/cost on Product (best-effort)
      if (isStockDirectionIn(stockDirection) && effectiveUnitCost > 0) {
        await amplifyClient.models.Product.update({
          idProduct: Number(item.productId),
          lastPurchasePrice: effectiveUnitCost,
          cost: effectiveUnitCost,
        } as any);
      }

      // Crear entrada en Kardex
      await createKardexEntry({
        productId: item.productId,
        date: new Date(String(docData.stockDate ?? postingDateIso)),
        documentId: Number(documentId),
        documentItemId: Number(item?.documentItemId),
        documentNumber: docData.number,
        warehouseId: Number(docData.warehouseId),
        type: isStockDirectionIn(stockDirection) ? 'ENTRADA' : 'SALIDA',
        quantity: postedQuantity,
        balance: newQuantity,
        previousBalance: currentQuantity,
        unitCost: effectiveUnitCost,
        totalCost: (effectiveUnitCost || 0) * postedQuantity,
        unitPrice: item.price,
        totalPrice: (Number(item.total ?? 0) || 0) * (requestedQuantity > 0 ? postedQuantity / requestedQuantity : 0),
        totalPriceAfterDiscount: (Number(item.priceAfterDiscount ?? 0) || 0) * (requestedQuantity > 0 ? postedQuantity / requestedQuantity : 0),
        userId: Number(userId),
        note: `From document ${docData.number}`,
      });
    }

    // Marcar documento como finalizado
    await amplifyClient.models.Document.update({
      documentId: Number(documentId),
      isClockedOut: true,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

// Exportar el servicio como objeto para compatibilidad
export async function listDocuments() {
  return amplifyClient.models.Document.list();
}

export const documentService = {
  generateDocumentNumber,
  createDocument,
  finalizeDocument,
  listDocuments,
};
