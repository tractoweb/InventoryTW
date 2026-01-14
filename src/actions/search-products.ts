'use server';

import { unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { inventoryService } from '@/services/inventory-service';

export type ProductSearchResult = {
  idProduct: number;
  name: string;
  code?: string | null;
  cost?: number | null;
  price?: number | null;
};

async function getSupplierProductIds(supplierId: number, maxDocs: number, maxItems: number): Promise<Set<number>> {
  const out = new Set<number>();

  const { data: docs } = await amplifyClient.models.Document.list({
    filter: {
      customerId: { eq: Number(supplierId) },
    },
    limit: maxDocs,
  } as any);

  const docIds = (docs ?? [])
    .map((d: any) => Number(d?.documentId))
    .filter((id) => Number.isFinite(id) && id > 0)
    .slice(0, maxDocs);

  for (const docId of docIds) {
    if (out.size >= maxItems) break;

    const { data: items } = await amplifyClient.models.DocumentItem.list({
      filter: { documentId: { eq: docId } },
      limit: Math.max(50, Math.min(200, maxItems - out.size)),
    } as any);

    for (const it of items ?? []) {
      const pid = Number((it as any)?.productId);
      if (Number.isFinite(pid) && pid > 0) out.add(pid);
      if (out.size >= maxItems) break;
    }
  }

  return out;
}

export async function searchProductsAction(
  query: string,
  limit: number = 30,
  opts?: { supplierId?: number; onlySupplierProducts?: boolean }
): Promise<{ data: ProductSearchResult[]; error?: string }> {
  noStore();

  const normalizedQuery = String(query ?? '').trim();

  try {
    const supplierId = Number(opts?.supplierId);
    const onlySupplierProducts = Boolean(opts?.onlySupplierProducts);
    const supplierSet = onlySupplierProducts && Number.isFinite(supplierId) && supplierId > 0
      ? await getSupplierProductIds(supplierId, 15, 500)
      : undefined;

    // If filtering by supplier and no query, return products from supplier history.
    if (supplierSet && normalizedQuery.length === 0) {
      const ids = Array.from(supplierSet).slice(0, limit);
      const fetched: any[] = [];
      for (const id of ids) {
        const { data } = await amplifyClient.models.Product.get({ idProduct: Number(id) } as any);
        if (data) fetched.push(data);
        if (fetched.length >= limit) break;
      }
      const data: ProductSearchResult[] = fetched
        .map((p: any) => ({
          idProduct: Number(p?.idProduct ?? p?.id ?? p?.productId),
          name: String(p?.name ?? ''),
          code: p?.code ?? null,
          cost: p?.cost ?? null,
          price: p?.price ?? null,
        }))
        .filter((p) => Number.isFinite(p.idProduct) && p.idProduct > 0 && p.name.length > 0);

      return { data };
    }

    const result = await inventoryService.searchProducts(normalizedQuery, limit);
    if (!result.success) {
      return { data: [], error: result.error || 'Error searching products' };
    }

    const products = (result.products ?? []) as any[];
    let data: ProductSearchResult[] = products
      .map((p) => ({
        idProduct: Number(p?.idProduct ?? p?.id ?? p?.productId),
        name: String(p?.name ?? ''),
        code: p?.code ?? null,
        cost: p?.cost ?? null,
        price: p?.price ?? null,
      }))
      .filter((p) => Number.isFinite(p.idProduct) && p.idProduct > 0 && p.name.length > 0);

    if (supplierSet) {
      data = data.filter((p) => supplierSet.has(p.idProduct));
    }

    return { data };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
