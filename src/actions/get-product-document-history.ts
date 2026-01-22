'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';

const KardexTypeSchema = z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']);

const GetProductDocumentHistorySchema = z.object({
  productId: z.coerce.number().int().positive(),
  warehouseId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ProductDocumentHistoryRow = {
  date: string;
  documentId: number;
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

  const { productId, warehouseId, limit } = parsed.data;

  try {
    const filterClauses: any[] = [];
    // Only show documents where the product ENTERED (for "precio con el que entró").
    filterClauses.push({ type: { eq: 'ENTRADA' } });
    if (warehouseId) filterClauses.push({ warehouseId: { eq: Number(warehouseId) } });

    const filter =
      filterClauses.length === 0 ? undefined : filterClauses.length === 1 ? filterClauses[0] : { and: filterClauses };

    const qListByProductId = /* GraphQL */ `
      query ListKardexByProductId(
        $productId: Int!
        $sortDirection: ModelSortDirection
        $filter: ModelKardexFilterInput
        $limit: Int
        $nextToken: String
      ) {
        listKardexByProductId(
          productId: $productId
          sortDirection: $sortDirection
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
          sortDirection: 'DESC',
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

        if (byDocumentId.has(normalizedDocId)) continue;

        const date = String(k?.date ?? '');
        byDocumentId.set(normalizedDocId, {
          date,
          documentId: normalizedDocId,
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
        });

        if (byDocumentId.size >= limit) break;
      }

      if (byDocumentId.size >= limit) break;
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
