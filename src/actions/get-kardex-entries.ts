'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';

const KardexTypeSchema = z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']);

const GetKardexEntriesSchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  type: KardexTypeSchema.optional(),
  dateFrom: z.string().optional(), // ISO string
  dateTo: z.string().optional(), // ISO string
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  nextToken: z.string().optional(),
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
  currentStock: number | null;
  userId: number | null;
  userName: string | null;
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
  nextToken?: string | null;
  error?: string;
}> {
  noStore();

  const parsed = GetKardexEntriesSchema.safeParse(raw ?? {});
  if (!parsed.success) return { data: [], error: 'Filtros inválidos' };

  const { productId, warehouseId, type, dateFrom, dateTo, limit, nextToken } = parsed.data;

  function safeIso(value: string | undefined): string | undefined {
    if (!value) return undefined;
    try {
      return new Date(value).toISOString();
    } catch {
      return undefined;
    }
  }

  try {
    const productClause = Number.isFinite(productId) ? { productId: { eq: Number(productId) } } : null;
    const warehouseClause = Number.isFinite(warehouseId) ? { warehouseId: { eq: Number(warehouseId) } } : null;
    const typeClause = type ? { type: { eq: type } } : null;

    const clauses: any[] = [];
    if (productClause) clauses.push(productClause);
    if (warehouseClause) clauses.push(warehouseClause);
    if (typeClause) clauses.push(typeClause);

    let df = safeIso(dateFrom);
    let dt = safeIso(dateTo);
    if (df && dt && df > dt) {
      const tmp = df;
      df = dt;
      dt = tmp;
    }

    if (df && dt) {
      clauses.push({ date: { between: [df, dt] } });
    } else if (df) {
      clauses.push({ date: { ge: df } });
    } else if (dt) {
      clauses.push({ date: { le: dt } });
    }

    const wantsProductIndex = productClause && Number(productId) > 0;
    const wantsWarehouseIndex = !wantsProductIndex && warehouseClause && Number(warehouseId) > 0;

    const filterClauses = clauses.filter((c) => {
      if (wantsProductIndex && c === productClause) return false;
      if (wantsWarehouseIndex && c === warehouseClause) return false;
      return true;
    });
    const filter =
      filterClauses.length === 0 ? undefined : filterClauses.length === 1 ? filterClauses[0] : { and: filterClauses };

    const qListByProductId = /* GraphQL */ `
      query ListKardexByProductId(
        $productId: Int!
        $filter: ModelKardexFilterInput
        $limit: Int
        $nextToken: String
      ) {
        listKardexByProductId(
          productId: $productId
          filter: $filter
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            kardexId
            date
            type
            productId
            warehouseId
            userId
            quantity
            balance
            unitCost
            totalCost
            unitPrice
            totalPrice
            totalPriceAfterDiscount
            documentId
            documentItemId
            documentNumber
            note
          }
          nextToken
        }
      }
    `;

    const qListByWarehouseId = /* GraphQL */ `
      query ListKardexByWarehouseId(
        $warehouseId: Int!
        $filter: ModelKardexFilterInput
        $limit: Int
        $nextToken: String
      ) {
        listKardexByWarehouseId(
          warehouseId: $warehouseId
          filter: $filter
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            kardexId
            date
            type
            productId
            warehouseId
            userId
            quantity
            balance
            unitCost
            totalCost
            unitPrice
            totalPrice
            totalPriceAfterDiscount
            documentId
            documentItemId
            documentNumber
            note
          }
          nextToken
        }
      }
    `;

    const qListAll = /* GraphQL */ `
      query ListKardexes(
        $filter: ModelKardexFilterInput
        $limit: Int
        $nextToken: String
      ) {
        listKardexes(filter: $filter, limit: $limit, nextToken: $nextToken) {
          items {
            kardexId
            date
            type
            productId
            warehouseId
            userId
            quantity
            balance
            unitCost
            totalCost
            unitPrice
            totalPrice
            totalPriceAfterDiscount
            documentId
            documentItemId
            documentNumber
            note
          }
          nextToken
        }
      }
    `;

    const commonVars = {
      filter,
      limit: Math.min(limit, 1000),
      nextToken,
    };

    let conn: any = null;
    try {
      if (wantsProductIndex) {
        const resp: any = await (amplifyClient as any).graphql({
          query: qListByProductId,
          variables: { ...commonVars, productId: Number(productId) },
        });
        conn = resp?.data?.listKardexByProductId;
      } else if (wantsWarehouseIndex) {
        const resp: any = await (amplifyClient as any).graphql({
          query: qListByWarehouseId,
          variables: { ...commonVars, warehouseId: Number(warehouseId) },
        });
        conn = resp?.data?.listKardexByWarehouseId;
      } else {
        const resp: any = await (amplifyClient as any).graphql({
          query: qListAll,
          variables: commonVars,
        });
        conn = resp?.data?.listKardexes;
      }
    } catch (err) {
      // Fallback to model list (scan) if the GraphQL client isn't available in this runtime.
      const page: any = await amplifyClient.models.Kardex.list({
        filter: clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : { and: clauses },
        limit: Math.min(limit, 1000),
        nextToken,
      } as any);

      if (page?.errors) return { data: [], error: 'No se pudieron cargar movimientos' };
      conn = { items: page?.data ?? [], nextToken: (page as any)?.nextToken ?? null };
    }

    const items = (conn?.items ?? []) as any[];
    const pageNextToken = (conn?.nextToken ?? null) as string | null;

    const entries = items
      .map((k: any) => ({
        kardexId: Number(k?.kardexId ?? 0),
        date: String(k?.date ?? ''),
        type: String(k?.type ?? '') as any,
        productId: Number(k?.productId ?? 0),
        warehouseId: k?.warehouseId !== undefined && k?.warehouseId !== null ? Number(k.warehouseId) : null,
        currentStock: null as number | null,
        userId: k?.userId !== undefined && k?.userId !== null ? Number(k.userId) : null,
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
        userName: null as string | null,
      }))
      .filter((k) => Number.isFinite(k.kardexId) && k.kardexId > 0 && Number.isFinite(k.productId) && k.productId > 0)
      // NOTE: list() order is not guaranteed; we sort client-side for usability.
      .sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()) || (b.kardexId - a.kardexId));

    const productIds = Array.from(new Set(entries.map((e) => e.productId)));
    const warehouseIds = Array.from(
      new Set(entries.map((e) => e.warehouseId).filter((id): id is number => typeof id === 'number' && Number.isFinite(id)))
    );

    const userIds = Array.from(
      new Set(entries.map((e) => e.userId).filter((id): id is number => typeof id === 'number' && Number.isFinite(id)))
    );

    const stockKeys = Array.from(
      new Set(
        entries
          .map((e) => {
            if (!e.warehouseId) return null;
            return `${e.productId}:${e.warehouseId}`;
          })
          .filter((k): k is string => Boolean(k))
      )
    );

    const [productGets, warehouseGets, userGets, stockGets] = await Promise.all([
      Promise.all(productIds.map((idProduct) => amplifyClient.models.Product.get({ idProduct } as any))),
      Promise.all(warehouseIds.map((idWarehouse) => amplifyClient.models.Warehouse.get({ idWarehouse } as any))),
      Promise.all(userIds.map((userId) => amplifyClient.models.User.get({ userId } as any))),
      Promise.all(
        stockKeys.map((key) => {
          const [p, w] = key.split(':');
          const productId = Number(p);
          const warehouseId = Number(w);
          return amplifyClient.models.Stock.get({ productId, warehouseId } as any);
        })
      ),
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

    const userById = new Map<number, string>();
    for (let i = 0; i < userIds.length; i++) {
      const u: any = (userGets[i] as any)?.data;
      if (u) userById.set(userIds[i], String(u?.username ?? String(userIds[i])));
    }

    const stockByKey = new Map<string, number>();
    for (let i = 0; i < stockKeys.length; i++) {
      const s: any = (stockGets[i] as any)?.data;
      if (!s) continue;
      const qty = Number(s?.quantity);
      if (!Number.isFinite(qty)) continue;
      stockByKey.set(stockKeys[i], qty);
    }

    const data: KardexEntryRow[] = entries.map((e) => {
      const p = productById.get(e.productId);
      const w = e.warehouseId ? warehouseById.get(e.warehouseId) : null;
      const u = e.userId ? userById.get(e.userId) : null;
      const currentStock = e.warehouseId ? stockByKey.get(`${e.productId}:${e.warehouseId}`) ?? null : null;
      return {
        ...e,
        productName: p?.name ?? null,
        productCode: p?.code ?? null,
        warehouseName: w ?? null,
        userName: u ?? null,
        currentStock,
      };
    });

    return { data, nextToken: pageNextToken };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
