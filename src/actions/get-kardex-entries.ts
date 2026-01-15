'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { listAllPages } from '@/services/amplify-list-all';

const KardexTypeSchema = z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']);

const GetKardexEntriesSchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  type: KardexTypeSchema.optional(),
  dateFrom: z.string().optional(), // ISO string
  dateTo: z.string().optional(), // ISO string
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export type KardexEntryRow = {
  kardexId: number;
  date: string;
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  productId: number;
  productName: string | null;
  productCode: string | null;
  warehouseId: number | null;
  warehouseName: string | null;
  quantity: number;
  balance: number;
  unitCost: number | null;
  totalCost: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  totalPriceAfterDiscount: number | null;
  documentId: number | null;
  documentItemId: number | null;
  documentNumber: string | null;
  note: string | null;
};

export async function getKardexEntriesAction(raw: z.input<typeof GetKardexEntriesSchema>): Promise<{
  data: KardexEntryRow[];
  error?: string;
}> {
  noStore();

  const parsed = GetKardexEntriesSchema.safeParse(raw);
  if (!parsed.success) return { data: [], error: 'Filtros inválidos' };

  const { productId, warehouseId, type, dateFrom, dateTo, limit } = parsed.data;

  try {
    const and: any[] = [];
    if (Number.isFinite(productId)) and.push({ productId: { eq: Number(productId) } });
    if (Number.isFinite(warehouseId)) and.push({ warehouseId: { eq: Number(warehouseId) } });
    if (type) and.push({ type: { eq: type } });

    if (dateFrom && dateTo) {
      and.push({ date: { between: [new Date(dateFrom).toISOString(), new Date(dateTo).toISOString()] } });
    } else if (dateFrom) {
      and.push({ date: { ge: new Date(dateFrom).toISOString() } });
    } else if (dateTo) {
      and.push({ date: { le: new Date(dateTo).toISOString() } });
    }

    const filter = and.length === 0 ? undefined : and.length === 1 ? and[0] : { and };

    const result = await listAllPages<any>((args) => amplifyClient.models.Kardex.list(args), {
      filter,
      limit: Math.min(limit, 1000),
    } as any);

    if ('error' in result) return { data: [], error: result.error };

    const entries = (result.data ?? [])
      .map((k: any) => ({
        kardexId: Number(k?.kardexId ?? 0),
        date: String(k?.date ?? ''),
        type: String(k?.type ?? '') as any,
        productId: Number(k?.productId ?? 0),
        warehouseId: k?.warehouseId !== undefined && k?.warehouseId !== null ? Number(k.warehouseId) : null,
        quantity: Number(k?.quantity ?? 0) || 0,
        balance: Number(k?.balance ?? 0) || 0,
        unitCost: k?.unitCost !== undefined && k?.unitCost !== null ? Number(k.unitCost) : null,
        totalCost: k?.totalCost !== undefined && k?.totalCost !== null ? Number(k.totalCost) : null,
        unitPrice: k?.unitPrice !== undefined && k?.unitPrice !== null ? Number(k.unitPrice) : null,
        totalPrice: k?.totalPrice !== undefined && k?.totalPrice !== null ? Number(k.totalPrice) : null,
        totalPriceAfterDiscount:
          k?.totalPriceAfterDiscount !== undefined && k?.totalPriceAfterDiscount !== null
            ? Number(k.totalPriceAfterDiscount)
            : null,
        documentId: k?.documentId !== undefined && k?.documentId !== null ? Number(k.documentId) : null,
        documentItemId: k?.documentItemId !== undefined && k?.documentItemId !== null ? Number(k.documentItemId) : null,
        documentNumber: k?.documentNumber ? String(k.documentNumber) : null,
        note: k?.note ? String(k.note) : null,
        productName: null as string | null,
        productCode: null as string | null,
        warehouseName: null as string | null,
      }))
      .filter((k) => Number.isFinite(k.kardexId) && k.kardexId > 0 && Number.isFinite(k.productId) && k.productId > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    const productIds = Array.from(new Set(entries.map((e) => e.productId)));
    const warehouseIds = Array.from(
      new Set(entries.map((e) => e.warehouseId).filter((id): id is number => typeof id === 'number' && Number.isFinite(id)))
    );

    const [productGets, warehouseGets] = await Promise.all([
      Promise.all(productIds.map((idProduct) => amplifyClient.models.Product.get({ idProduct } as any))),
      Promise.all(warehouseIds.map((idWarehouse) => amplifyClient.models.Warehouse.get({ idWarehouse } as any))),
    ]);

    const productById = new Map<number, { name: string; code: string | null }>();
    for (let i = 0; i < productIds.length; i++) {
      const p: any = (productGets[i] as any)?.data;
      if (p) productById.set(productIds[i], { name: String(p?.name ?? ''), code: p?.code ? String(p.code) : null });
    }

    const warehouseById = new Map<number, string>();
    for (let i = 0; i < warehouseIds.length; i++) {
      const w: any = (warehouseGets[i] as any)?.data;
      if (w) warehouseById.set(warehouseIds[i], String(w?.name ?? String(warehouseIds[i])));
    }

    const data: KardexEntryRow[] = entries.map((e) => {
      const p = productById.get(e.productId);
      const w = e.warehouseId ? warehouseById.get(e.warehouseId) : null;
      return {
        ...e,
        productName: p?.name ?? null,
        productCode: p?.code ?? null,
        warehouseName: w ?? null,
      };
    });

    return { data };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
