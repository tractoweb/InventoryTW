'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { formatAmplifyError } from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-server';

const KardexTypeSchema = z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']);

const GetProductDocumentHistorySchema = z.object({
  productId: z.coerce.number().int().positive(),
  warehouseId: z.coerce.number().int().positive().optional(),
  type: KardexTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ProductDocumentHistoryRow = {
  date: string;
  documentId: number;
  documentItemId: number | null;
  documentNumber: string | null;
  unitPrice: number | null;
  type: z.infer<typeof KardexTypeSchema>;
  warehouseId: number | null;
};

export async function getProductDocumentHistoryAction(
  raw: z.input<typeof GetProductDocumentHistorySchema>
): Promise<{ data: ProductDocumentHistoryRow[]; error?: string }> {
  noStore();

  const parsed = GetProductDocumentHistorySchema.safeParse(raw ?? {});
  if (!parsed.success) return { data: [], error: 'Filtros inválidos' };

  const { productId, warehouseId, type, limit } = parsed.data;

  try {
    const filterClauses: any[] = [];
    // Default to ENTRADA for backwards compatibility.
    filterClauses.push({ type: { eq: type ?? 'ENTRADA' } });
    if (warehouseId) filterClauses.push({ warehouseId: { eq: Number(warehouseId) } });

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
            warehouseId
            documentId
            documentItemId
            documentNumber
            unitPrice
          }
          nextToken
        }
      }
    `;

    // We want unique documents. Fetch a bit more than needed (paged) and dedupe.
    const byDocumentId = new Map<number, ProductDocumentHistoryRow>();

    let nextToken: string | null | undefined = undefined;
    let scanned = 0;
    const maxScan = 1200;
    const pageLimit = 250;

    while (scanned < maxScan) {
      const resp: any = await (amplifyClient as any).graphql({
        query: qListByProductId,
        variables: {
          productId: Number(productId),
          filter,
          limit: pageLimit,
          nextToken,
        },
      });

      const conn = resp?.data?.listKardexByProductId;
      const items = (conn?.items ?? []) as any[];
      nextToken = (conn?.nextToken ?? null) as string | null;

      scanned += items.length;

      for (const k of items) {
        const docId = k?.documentId;
        if (docId === undefined || docId === null) continue;
        const normalizedDocId = Number(docId);
        if (!Number.isFinite(normalizedDocId) || normalizedDocId <= 0) continue;

        const date = String(k?.date ?? '');
        const row: ProductDocumentHistoryRow = {
          date,
          documentId: normalizedDocId,
          documentItemId:
            k?.documentItemId !== undefined && k?.documentItemId !== null && Number.isFinite(Number(k.documentItemId))
              ? Number(k.documentItemId)
              : null,
          documentNumber: k?.documentNumber ? String(k.documentNumber) : null,
          unitPrice:
            k?.unitPrice !== undefined && k?.unitPrice !== null && Number.isFinite(Number(k.unitPrice))
              ? Number(k.unitPrice)
              : null,
          type: KardexTypeSchema.parse(String(k?.type ?? 'AJUSTE')),
          warehouseId:
            k?.warehouseId !== undefined && k?.warehouseId !== null && Number.isFinite(Number(k.warehouseId))
              ? Number(k.warehouseId)
              : null,
        };

        // Keep the most recent row per documentId (since server ordering isn't guaranteed).
        const prev = byDocumentId.get(normalizedDocId);
        if (!prev) {
          byDocumentId.set(normalizedDocId, row);
        } else {
          const prevMs = new Date(prev.date).getTime();
          const rowMs = new Date(row.date).getTime();
          if ((Number.isFinite(rowMs) ? rowMs : 0) > (Number.isFinite(prevMs) ? prevMs : 0)) {
            byDocumentId.set(normalizedDocId, row);
          }
        }
      }

      if (!nextToken) break;
    }

    const data = Array.from(byDocumentId.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return { data };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
