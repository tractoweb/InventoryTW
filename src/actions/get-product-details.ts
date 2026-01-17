"use server";

import { inventoryService } from '@/services/inventory-service';
import { cached } from '@/lib/server-cache';
import { CACHE_TAGS } from '@/lib/cache-tags';

export async function getProductDetails(productId: number) {
  if (!productId) {
    return { error: 'Product ID is required.' };
  }

  try {
    const load = cached(
      () => inventoryService.getProductDetails(String(productId)),
      {
        keyParts: ['product-details', String(productId)],
        revalidateSeconds: 45,
        tags: [CACHE_TAGS.heavy.productDetails],
      }
    );

    const data = await load();
    return { data };

  } catch (error: any) {
    console.error(`Error obteniendo detalles para el producto ${productId}:`, error);
    return { error: error.message || 'Error al obtener detalles del producto.' };
  }
}

