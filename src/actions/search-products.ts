'use server';

import { unstable_noStore as noStore } from 'next/cache';

import { inventoryService } from '@/services/inventory-service';

export type ProductSearchResult = {
  idProduct: number;
  name: string;
  code?: string | null;
  cost?: number | null;
  price?: number | null;
};

export async function searchProductsAction(query: string, limit: number = 30): Promise<{ data: ProductSearchResult[]; error?: string }> {
  noStore();

  const normalizedQuery = String(query ?? '').trim();

  const result = await inventoryService.searchProducts(normalizedQuery, limit);
  if (!result.success) {
    return { data: [], error: result.error || 'Error searching products' };
  }

  const products = (result.products ?? []) as any[];

  const data: ProductSearchResult[] = products
    .map((p) => ({
      idProduct: Number(p?.idProduct ?? p?.id ?? p?.productId),
      name: String(p?.name ?? ''),
      code: p?.code ?? null,
      cost: p?.cost ?? null,
      price: p?.price ?? null,
    }))
    .filter((p) => Number.isFinite(p.idProduct) && p.idProduct > 0 && p.name.length > 0);

  return { data };
}
