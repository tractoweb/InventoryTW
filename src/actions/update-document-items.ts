'use server';

import { z } from 'zod';
import { revalidateTag, unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, DOCUMENT_STOCK_DIRECTION, KARDEX_TYPES, formatAmplifyError, normalizeStockDirection } from '@/lib/amplify-config';
import { allocateCounterRange, ensureCounterAtLeast } from '@/lib/allocate-counter-range';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { listAllPages } from '@/services/amplify-list-all';
import { createKardexEntry } from '@/services/kardex-service';
import { getCurrentSession } from '@/lib/session';
import { writeAuditLog } from '@/services/audit-log-service';
import { parseDecimalLooseOptional } from "@/lib/parse-decimal";

const UpdateDocumentItemsSchema = z.object({
  documentId: z.coerce.number().min(1),
  items: z
    .array(
      z.object({
        documentItemId: z.coerce.number().min(1).optional(),
        productId: z.coerce.number().min(1).optional(),
        quantity: z.preprocess(parseDecimalLooseOptional, z.number().min(0)),
        price: z.preprocess(parseDecimalLooseOptional, z.number().min(0)),
        updateProductPrice: z.coerce.boolean().optional(),
        remove: z.coerce.boolean().optional(),
      })
    )
    .default([]),
});

export type UpdateDocumentItemsInput = z.input<typeof UpdateDocumentItemsSchema>;

export async function updateDocumentItemsAction(
  raw: UpdateDocumentItemsInput
): Promise<{ success: boolean; error?: string }> {
  noStore();

  const parsed = UpdateDocumentItemsSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos inválidos' };

  try {
    const documentId = Number(parsed.data.documentId);
    const sessionRes = await getCurrentSession();
    const sessionUserId = Number(sessionRes.data?.userId ?? 0) || undefined;

    const docRes: any = await amplifyClient.models.Document.get({ documentId } as any);
    const doc = docRes?.data as any;
    if (!doc) return { success: false, error: 'Documento no encontrado' };

    const isFinalized = Boolean(doc.isClockedOut);

    // Resolve docType for pricing/tax logic.
    const dtRes: any = await amplifyClient.models.DocumentType.get({ documentTypeId: Number(doc.documentTypeId) } as any);
    const dt = dtRes?.data as any;
    const stockDirection = normalizeStockDirection(dt?.stockDirection ?? DOCUMENT_STOCK_DIRECTION.NONE);
    const stockDirectionMultiplier =
      stockDirection === DOCUMENT_STOCK_DIRECTION.IN
        ? 1
        : stockDirection === DOCUMENT_STOCK_DIRECTION.OUT
          ? -1
          : 0;

    const pricesIncludeTax = (() => {
      if (stockDirection === DOCUMENT_STOCK_DIRECTION.OUT) return true;
      if (stockDirection === DOCUMENT_STOCK_DIRECTION.IN) {
        const rawNote = doc.internalNote;
        if (typeof rawNote === 'string' && rawNote.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(rawNote);
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

    const itemsRes = await listAllPages<any>((args) => amplifyClient.models.DocumentItem.list(args), {
      filter: { documentId: { eq: Number(documentId) } },
    });
    if ('error' in itemsRes) return { success: false, error: itemsRes.error };

    const existingItems = itemsRes.data ?? [];
    const existingById = new Map<number, any>();
    for (const it of existingItems) {
      const id = Number((it as any)?.documentItemId);
      if (Number.isFinite(id) && id > 0) existingById.set(id, it);
    }
    const existingBeforeById = new Map<number, any>();
    for (const it of existingItems) {
      const id = Number((it as any)?.documentItemId);
      if (!Number.isFinite(id) || id <= 0) continue;
      existingBeforeById.set(id, {
        documentItemId: id,
        productId: Number((it as any)?.productId),
        quantity: Number((it as any)?.quantity ?? 0) || 0,
        price: Number((it as any)?.price ?? 0) || 0,
        total: Number((it as any)?.total ?? 0) || 0,
        productCost: Number((it as any)?.productCost ?? 0) || 0,
        productNameSnapshot: typeof (it as any)?.productNameSnapshot === 'string' ? String((it as any).productNameSnapshot) : undefined,
      });
    }

    const requested = (parsed.data.items ?? []).map((i) => ({
      documentItemId: i.documentItemId !== undefined ? Number(i.documentItemId) : undefined,
      productId: i.productId !== undefined ? Number(i.productId) : undefined,
      quantity: Number(i.quantity ?? 0) || 0,
      price: Number(i.price ?? 0) || 0,
      updateProductPrice: Boolean(i.updateProductPrice),
      remove: Boolean(i.remove),
    }));

    // Validate shape.
    for (const r of requested) {
      const hasExistingId = Number.isFinite(Number(r.documentItemId)) && Number(r.documentItemId) > 0;
      const hasProductId = Number.isFinite(Number(r.productId)) && Number(r.productId) > 0;
      if (!hasExistingId && !hasProductId) {
        return { success: false, error: 'Cada ítem debe tener documentItemId (existente) o productId (nuevo).' };
      }
      if (hasExistingId && hasProductId) {
        return { success: false, error: 'Cada ítem debe tener solo uno: documentItemId o productId.' };
      }
    }

    // Only allow updates for items that belong to this document.
    for (const r of requested) {
      if (r.documentItemId !== undefined) {
        if (!existingById.has(Number(r.documentItemId))) {
          return { success: false, error: `Ítem no encontrado en este documento (documentItemId: ${r.documentItemId}).` };
        }
      }
    }

    const oldValues = existingItems.map((it: any) => ({
      documentItemId: Number(it.documentItemId),
      productId: Number(it.productId),
      quantity: Number(it.quantity ?? 0) || 0,
      price: Number(it.price ?? 0) || 0,
      total: Number(it.total ?? 0) || 0,
    }));

    async function seedCounterFromExistingMax(counterName: string) {
      const all = await listAllPages<any>((args) => amplifyClient.models.DocumentItem.list(args));
      if ('error' in all) {
        const msg = typeof (all as any).error === 'string' ? (all as any).error : 'Error leyendo datos existentes';
        throw new Error(msg);
      }
      const maxExistingId = all.data.reduce((max, row: any) => {
        const id = Number(row?.documentItemId ?? 0);
        return Number.isFinite(id) ? Math.max(max, id) : max;
      }, 0);
      await ensureCounterAtLeast(counterName, maxExistingId);
    }

    async function allocateFreeDocumentItemIds(count: number): Promise<number[]> {
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidates = await allocateCounterRange('documentItemId', count);
        const checks = await Promise.all(
          candidates.map((id) => amplifyClient.models.DocumentItem.get({ documentItemId: id } as any))
        );

        const anyExists = checks.some((r: any) => Boolean(r?.data));
        if (!anyExists) return candidates;

        await seedCounterFromExistingMax('documentItemId');
      }
      throw new Error('No se pudo asignar documentItemId(s) libres');
    }

    async function resolveTaxRowsForProduct(productId: number): Promise<Array<{ taxId: number; rate: number; isFixed: boolean }>> {
      // Try ProductTax mapping first.
      let taxIds: number[] = [];
      try {
        const { data } = (await amplifyClient.models.ProductTax.list({
          filter: { productId: { eq: Number(productId) } },
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
          // ignore
        }
      }
      return taxRows;
    }

    async function rewriteItemTaxes(documentItemId: number, productId: number, grossAfterDiscount: number, divisor: number, rateSum: number) {
      // Delete current taxes
      const taxesRes = await listAllPages<any>((args) => amplifyClient.models.DocumentItemTax.list(args), {
        filter: { documentItemId: { eq: Number(documentItemId) } },
      });
      if (!('error' in taxesRes)) {
        for (const t of taxesRes.data ?? []) {
          const taxId = Number((t as any)?.taxId);
          if (!Number.isFinite(taxId)) continue;
          await amplifyClient.models.DocumentItemTax.delete({ documentItemId, taxId } as any);
        }
      }

      const taxRows = await resolveTaxRowsForProduct(productId);
      const percentTaxes = taxRows.filter((t) => !t.isFixed && t.rate > 0);
      const localRateSum = percentTaxes.reduce((acc, t) => acc + t.rate, 0);
      const localDivisor = 1 + localRateSum / 100;

      // If caller provides a divisor/rateSum, prefer those (already computed).
      const finalRateSum = Number.isFinite(rateSum) && rateSum > 0 ? rateSum : localRateSum;
      const finalDivisor = Number.isFinite(divisor) && divisor > 0 ? divisor : localDivisor;

      if (percentTaxes.length && finalRateSum > 0) {
        const gross = grossAfterDiscount;
        const net = pricesIncludeTax && finalDivisor > 0 ? gross / finalDivisor : gross;
        const totalTax = pricesIncludeTax ? gross - net : (net * finalRateSum) / 100;

        for (const t of percentTaxes) {
          const amount = pricesIncludeTax
            ? (totalTax * t.rate) / finalRateSum
            : (net * t.rate) / 100;

          if (!amount) continue;

          await amplifyClient.models.DocumentItemTax.create({
            documentItemId: Number(documentItemId) as any,
            taxId: Number(t.taxId),
            amount,
          } as any);
        }
      }
    }

    // Apply deletes first (existing items only).
    const toDelete = requested.filter((r) => r.documentItemId !== undefined && (r.remove || !(r.quantity > 0)));
    for (const r of toDelete) {
      const documentItemId = Number(r.documentItemId);

      const taxesRes = await listAllPages<any>((args) => amplifyClient.models.DocumentItemTax.list(args), {
        filter: { documentItemId: { eq: Number(documentItemId) } },
      });
      if (!('error' in taxesRes)) {
        for (const t of taxesRes.data ?? []) {
          const taxId = Number((t as any)?.taxId);
          if (!Number.isFinite(taxId)) continue;
          await amplifyClient.models.DocumentItemTax.delete({ documentItemId, taxId } as any);
        }
      }

      // Best-effort cleanup for price view.
      try {
        await amplifyClient.models.DocumentItemPriceView.delete({ documentItemId } as any);
      } catch {
        // ignore
      }

      await amplifyClient.models.DocumentItem.delete({ documentItemId } as any);
      existingById.delete(documentItemId);
    }

    // Allocate IDs for new items.
    const newItems = requested.filter((r) => r.documentItemId === undefined && !r.remove && r.quantity > 0);
    const newIds = newItems.length ? await allocateFreeDocumentItemIds(newItems.length) : [];

    // Apply updates to existing items.
    const toUpdate = requested.filter((r) => r.documentItemId !== undefined && !r.remove && r.quantity > 0);
    for (const r of toUpdate) {
      const documentItemId = Number(r.documentItemId);
      const prev = existingById.get(documentItemId);
      if (!prev) continue;

      const productId = Number((prev as any)?.productId);
      const itemPrice = Math.max(0, r.price);
      const itemQty = Math.max(0, r.quantity);
      const itemTotal = itemQty * itemPrice;

      const discount = Number((prev as any)?.discount ?? 0) || 0;
      const discountType = Number((prev as any)?.discountType ?? 0) || 0;

      let lineAmountAfterDiscount = itemTotal;
      if (discount > 0) {
        lineAmountAfterDiscount =
          discountType === 0
            ? itemTotal - discount
            : itemTotal * (1 - discount / 100);
      }

      const taxRows = await resolveTaxRowsForProduct(productId);
      const percentTaxes = taxRows.filter((t) => !t.isFixed && t.rate > 0);
      const rateSum = percentTaxes.reduce((acc, t) => acc + t.rate, 0);
      const divisor = 1 + rateSum / 100;

      const grossAfterDiscount = lineAmountAfterDiscount;
      const netAfterDiscount = pricesIncludeTax && divisor > 0 ? grossAfterDiscount / divisor : grossAfterDiscount;
      const unitNet = pricesIncludeTax && divisor > 0 ? itemPrice / divisor : itemPrice;

      await amplifyClient.models.DocumentItem.update({
        documentItemId,
        quantity: itemQty,
        expectedQuantity: itemQty,
        price: itemPrice,
        priceBeforeTax: unitNet,
        priceBeforeTaxAfterDiscount: netAfterDiscount,
        priceAfterDiscount: grossAfterDiscount,
        total: itemTotal,
        totalAfterDocumentDiscount: grossAfterDiscount,
      } as any);

      await rewriteItemTaxes(documentItemId, productId, grossAfterDiscount, divisor, rateSum);

      // Keep price view aligned (best-effort)
      try {
        await amplifyClient.models.DocumentItemPriceView.update({
          documentItemId,
          price: itemPrice,
          documentId: Number(documentId),
        } as any);
      } catch {
        try {
          await amplifyClient.models.DocumentItemPriceView.create({
            documentItemId,
            price: itemPrice,
            documentId: Number(documentId),
          } as any);
        } catch {
          // ignore
        }
      }

      existingById.set(documentItemId, {
        ...(prev as any),
        quantity: itemQty,
        expectedQuantity: itemQty,
        price: itemPrice,
        total: itemTotal,
        priceAfterDiscount: grossAfterDiscount,
        totalAfterDocumentDiscount: grossAfterDiscount,
      });
    }

    // Apply creates for new items.
    for (let idx = 0; idx < newItems.length; idx++) {
      const r = newItems[idx];
      const documentItemId = Number(newIds[idx]);
      const productId = Number(r.productId);

      const productRes = await amplifyClient.models.Product.get({ idProduct: Number(productId) } as any);
      const productData = (productRes as any)?.data as any;

      const productNameSnapshot = typeof productData?.name === 'string' ? productData.name : undefined;
      const productCodeSnapshot = typeof productData?.code === 'string' ? productData.code : undefined;
      const measurementUnitSnapshot = typeof productData?.measurementUnit === 'string' ? productData.measurementUnit : undefined;

      let barcodeSnapshot: string | undefined;
      try {
        const { data } = (await amplifyClient.models.Barcode.list({
          filter: { productId: { eq: Number(productId) } },
          limit: 1,
        } as any)) as any;
        const first = Array.isArray(data) ? data[0] : null;
        if (first?.value) barcodeSnapshot = String(first.value);
      } catch {
        // ignore
      }

      const itemPrice = Math.max(0, r.price);
      const itemQty = Math.max(0, r.quantity);
      const itemTotal = itemQty * itemPrice;

      const discount = 0;
      const discountType = 0;
      const grossAfterDiscount = itemTotal;

      const taxRows = await resolveTaxRowsForProduct(productId);
      const percentTaxes = taxRows.filter((t) => !t.isFixed && t.rate > 0);
      const rateSum = percentTaxes.reduce((acc, t) => acc + t.rate, 0);
      const divisor = 1 + rateSum / 100;

      const netAfterDiscount = pricesIncludeTax && divisor > 0 ? grossAfterDiscount / divisor : grossAfterDiscount;
      const unitNet = pricesIncludeTax && divisor > 0 ? itemPrice / divisor : itemPrice;

      const itemPayload: any = {
        documentItemId,
        documentId: Number(documentId),
        productId: Number(productId),
        productNameSnapshot,
        productCodeSnapshot,
        measurementUnitSnapshot,
        barcodeSnapshot,
        quantity: itemQty,
        expectedQuantity: itemQty,
        price: itemPrice,
        priceBeforeTax: unitNet,
        discount,
        discountType,
        productCost: Number(productData?.cost ?? 0) || 0,
        priceBeforeTaxAfterDiscount: netAfterDiscount,
        priceAfterDiscount: grossAfterDiscount,
        total: itemTotal,
        totalAfterDocumentDiscount: grossAfterDiscount,
        discountApplyRule: 0,
      };

      await amplifyClient.models.DocumentItem.create(itemPayload as any);
      await rewriteItemTaxes(documentItemId, productId, grossAfterDiscount, divisor, rateSum);

      existingById.set(documentItemId, {
        ...itemPayload,
      });
    }

    // Persist per-item price update flags inside Document.internalNote (JSON merge).
    try {
      const rawInternal = typeof (doc as any)?.internalNote === 'string' ? String((doc as any).internalNote) : '';
      let internalObj: any = null;
      if (rawInternal.trim().startsWith('{')) {
        try {
          internalObj = JSON.parse(rawInternal);
        } catch {
          internalObj = null;
        }
      }
      if (!internalObj || typeof internalObj !== 'object') {
        internalObj = rawInternal ? { legacyInternalNote: rawInternal } : {};
      }

      const existingFlagsRaw = internalObj?.priceUpdate?.documentItemFlags;
      const nextFlags: Record<string, boolean> = {};
      if (existingFlagsRaw && typeof existingFlagsRaw === 'object') {
        for (const [k, v] of Object.entries(existingFlagsRaw)) {
          const id = Number(k);
          if (Number.isFinite(id) && id > 0 && Boolean(v)) nextFlags[String(id)] = true;
        }
      }

      // Remove deleted items from flags.
      for (const r of toDelete) {
        if (r.documentItemId !== undefined) delete nextFlags[String(Number(r.documentItemId))];
      }

      // Apply updates for existing items included in request.
      for (const r of requested) {
        if (r.documentItemId === undefined) continue;
        const id = Number(r.documentItemId);
        if (!(id > 0)) continue;
        if (r.remove || !(r.quantity > 0)) {
          delete nextFlags[String(id)];
          continue;
        }
        if (r.updateProductPrice) nextFlags[String(id)] = true;
        else delete nextFlags[String(id)];
      }

      // Apply flags for newly created items.
      for (let idx = 0; idx < newItems.length; idx++) {
        const r = newItems[idx];
        const id = Number(newIds[idx]);
        if (!(id > 0)) continue;
        if (r.updateProductPrice) nextFlags[String(id)] = true;
        else delete nextFlags[String(id)];
      }

      const hasAny = Object.keys(nextFlags).length > 0;
      if (hasAny) {
        internalObj.priceUpdate = {
          version: 1,
          documentItemFlags: nextFlags,
        };
      } else if (internalObj?.priceUpdate) {
        delete internalObj.priceUpdate;
      }

      await amplifyClient.models.Document.update({
        documentId: Number(documentId),
        internalNote: JSON.stringify(internalObj),
      } as any);
      (doc as any).internalNote = JSON.stringify(internalObj);
    } catch {
      // ignore (best-effort)
    }

    // Recompute document total from remaining items (same as createDocument).
    let nextTotal = Array.from(existingById.values()).reduce((sum, it: any) => {
      const qty = Number(it?.quantity ?? 0) || 0;
      const price = Number(it?.price ?? 0) || 0;
      const line = qty * price;
      return sum + (Number.isFinite(line) ? line : 0);
    }, 0);

    const docDiscount = Number((doc as any)?.discount ?? 0) || 0;
    const docDiscountType = Number((doc as any)?.discountType ?? 0) || 0;
    if (docDiscount > 0) {
      nextTotal = docDiscountType === 0 ? nextTotal - docDiscount : nextTotal * (1 - docDiscount / 100);
    }

    await amplifyClient.models.Document.update({
      documentId: Number(documentId),
      total: Math.max(0, nextTotal),
    } as any);

    if (isFinalized && stockDirectionMultiplier !== 0) {
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

      const changeEvents: Array<{
        productId: number;
        documentItemId?: number;
        stockDelta: number;
        oldQuantity: number;
        newQuantity: number;
        oldPrice: number;
        newPrice: number;
        unitCost: number;
        label: string;
      }> = [];

      for (const [documentItemId, before] of existingBeforeById.entries()) {
        const after = existingById.get(documentItemId);
        if (!after) {
          changeEvents.push({
            productId: Number(before.productId),
            documentItemId,
            stockDelta: stockDirectionMultiplier * (0 - Number(before.quantity ?? 0)),
            oldQuantity: Number(before.quantity ?? 0),
            newQuantity: 0,
            oldPrice: Number(before.price ?? 0),
            newPrice: 0,
            unitCost: Number(before.productCost ?? 0) || Number(before.price ?? 0) || 0,
            label: before.productNameSnapshot || `Producto ${before.productId}`,
          });
          continue;
        }

        const nextQty = Number((after as any)?.quantity ?? 0) || 0;
        const prevQty = Number(before.quantity ?? 0) || 0;
        const nextPrice = Number((after as any)?.price ?? 0) || 0;
        const prevPrice = Number(before.price ?? 0) || 0;
        const stockDelta = stockDirectionMultiplier * (nextQty - prevQty);

        if (stockDelta !== 0 || nextPrice !== prevPrice) {
          changeEvents.push({
            productId: Number((after as any)?.productId ?? before.productId),
            documentItemId,
            stockDelta,
            oldQuantity: prevQty,
            newQuantity: nextQty,
            oldPrice: prevPrice,
            newPrice: nextPrice,
            unitCost: Number((after as any)?.productCost ?? before.productCost ?? 0) || nextPrice || prevPrice || 0,
            label:
              (typeof (after as any)?.productNameSnapshot === 'string' && String((after as any).productNameSnapshot)) ||
              before.productNameSnapshot ||
              `Producto ${before.productId}`,
          });
        }
      }

      for (const [documentItemId, after] of existingById.entries()) {
        if (existingBeforeById.has(documentItemId)) continue;
        changeEvents.push({
          productId: Number((after as any)?.productId),
          documentItemId,
          stockDelta: stockDirectionMultiplier * (Number((after as any)?.quantity ?? 0) || 0),
          oldQuantity: 0,
          newQuantity: Number((after as any)?.quantity ?? 0) || 0,
          oldPrice: 0,
          newPrice: Number((after as any)?.price ?? 0) || 0,
          unitCost: Number((after as any)?.productCost ?? 0) || Number((after as any)?.price ?? 0) || 0,
          label:
            (typeof (after as any)?.productNameSnapshot === 'string' && String((after as any).productNameSnapshot)) ||
            `Producto ${(after as any)?.productId}`,
        });
      }

      const currentStockByProduct = new Map<number, number>();
      const uniqueProductIds = Array.from(new Set(changeEvents.map((event) => Number(event.productId)).filter((id) => Number.isFinite(id) && id > 0)));
      for (const productId of uniqueProductIds) {
        try {
          const stockRes: any = await amplifyClient.models.Stock.get({ productId, warehouseId: Number(doc.warehouseId) } as any);
          currentStockByProduct.set(productId, Number(stockRes?.data?.quantity ?? 0) || 0);
        } catch {
          currentStockByProduct.set(productId, 0);
        }
      }

      if (!allowNegativeStock) {
        const aggregatedDeltaByProduct = new Map<number, number>();
        for (const event of changeEvents) {
          aggregatedDeltaByProduct.set(event.productId, (aggregatedDeltaByProduct.get(event.productId) ?? 0) + event.stockDelta);
        }
        for (const [productId, delta] of aggregatedDeltaByProduct.entries()) {
          const nextBalance = (currentStockByProduct.get(productId) ?? 0) + delta;
          if (nextBalance < 0) {
            return {
              success: false,
              error: `La edición del documento finalizado dejaría stock negativo para el producto ${productId} en la bodega.`
            };
          }
        }
      }

      for (const event of changeEvents) {
        const currentBalance = currentStockByProduct.get(event.productId) ?? 0;
        const nextBalance = currentBalance + event.stockDelta;

        if (event.stockDelta !== 0) {
          const existingStockRes: any = await amplifyClient.models.Stock.get({
            productId: Number(event.productId),
            warehouseId: Number(doc.warehouseId),
          } as any).catch(() => null);

          if (existingStockRes?.data) {
            await amplifyClient.models.Stock.update({
              productId: Number(event.productId),
              warehouseId: Number(doc.warehouseId),
              quantity: nextBalance,
            } as any);
          } else {
            await amplifyClient.models.Stock.create({
              productId: Number(event.productId),
              warehouseId: Number(doc.warehouseId),
              quantity: nextBalance,
            } as any);
          }
          currentStockByProduct.set(event.productId, nextBalance);
        }

        const parts: string[] = [`EDICION DOCUMENTO FINALIZADO ${String(doc.number ?? documentId)}`];
        if (event.oldQuantity !== event.newQuantity) parts.push(`cantidad ${event.oldQuantity} -> ${event.newQuantity}`);
        if (event.oldPrice !== event.newPrice) parts.push(`precio ${event.oldPrice} -> ${event.newPrice}`);
        if (event.oldQuantity === 0 && event.newQuantity > 0) parts.push('item agregado');
        if (event.oldQuantity > 0 && event.newQuantity === 0) parts.push('item eliminado');

        await createKardexEntry({
          productId: Number(event.productId),
          date: new Date(),
          documentId: Number(documentId),
          documentItemId: event.documentItemId,
          documentNumber: String(doc.number ?? documentId),
          warehouseId: Number(doc.warehouseId),
          type: KARDEX_TYPES.AJUSTE,
          quantity: event.stockDelta,
          previousBalance: currentBalance,
          balance: event.stockDelta !== 0 ? nextBalance : currentBalance,
          unitCost: event.unitCost || undefined,
          totalCost: event.unitCost ? event.unitCost * event.stockDelta : undefined,
          unitPrice: event.newPrice || undefined,
          totalPrice: event.newPrice ? event.newPrice * event.newQuantity : undefined,
          totalPriceAfterDiscount: event.newPrice ? event.newPrice * event.newQuantity : undefined,
          note: `${parts.join(' · ')} · ${event.label}`,
          userId: sessionUserId,
        });
      }
    }

    if (sessionRes.data?.userId) {
      writeAuditLog({
        userId: sessionRes.data.userId,
        action: 'UPDATE',
        tableName: 'DocumentItem',
        recordId: Number(documentId),
        oldValues,
        newValues: {
          documentId,
          finalizedEdit: isFinalized,
          total: Math.max(0, nextTotal),
          items: requested,
        },
      }).catch(() => {});
    }

    revalidateTag(CACHE_TAGS.heavy.documents);
    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
    revalidateTag(CACHE_TAGS.heavy.stockData);

    return { success: true };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
