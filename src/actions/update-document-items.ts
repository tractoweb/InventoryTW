'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { DOCUMENT_STOCK_DIRECTION, formatAmplifyError } from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-server';
import { allocateCounterRange, ensureCounterAtLeast } from '@/lib/allocate-counter-range';
import { listAllPages } from '@/services/amplify-list-all';
import { getCurrentSession } from '@/lib/session';
import { writeAuditLog } from '@/services/audit-log-service';

const UpdateDocumentItemsSchema = z.object({
  documentId: z.coerce.number().min(1),
  items: z
    .array(
      z.object({
        documentItemId: z.coerce.number().min(1).optional(),
        productId: z.coerce.number().min(1).optional(),
        quantity: z.coerce.number().min(0),
        price: z.coerce.number().min(0),
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

    const docRes: any = await amplifyClient.models.Document.get({ documentId } as any);
    const doc = docRes?.data as any;
    if (!doc) return { success: false, error: 'Documento no encontrado' };

    if (Boolean(doc.isClockedOut)) {
      return { success: false, error: 'No se puede modificar un documento finalizado (impacta stock/kardex).' };
    }

    // Resolve docType for pricing/tax logic.
    const dtRes: any = await amplifyClient.models.DocumentType.get({ documentTypeId: Number(doc.documentTypeId) } as any);
    const dt = dtRes?.data as any;
    const stockDirection = Number(dt?.stockDirection ?? DOCUMENT_STOCK_DIRECTION.NONE) || DOCUMENT_STOCK_DIRECTION.NONE;

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

    const requested = (parsed.data.items ?? []).map((i) => ({
      documentItemId: i.documentItemId !== undefined ? Number(i.documentItemId) : undefined,
      productId: i.productId !== undefined ? Number(i.productId) : undefined,
      quantity: Number(i.quantity ?? 0) || 0,
      price: Number(i.price ?? 0) || 0,
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

    const sessionRes = await getCurrentSession();
    if (sessionRes.data?.userId) {
      writeAuditLog({
        userId: sessionRes.data.userId,
        action: 'UPDATE',
        tableName: 'DocumentItem',
        recordId: Number(documentId),
        oldValues,
        newValues: {
          documentId,
          total: Math.max(0, nextTotal),
          items: requested,
        },
      }).catch(() => {});
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
