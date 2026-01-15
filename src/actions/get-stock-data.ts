
import type { StockInfo } from '@/lib/types';
import { unstable_noStore as noStore } from 'next/cache';
import { amplifyClient } from '@/lib/amplify-config';
import { listAllPages } from '@/services/amplify-list-all';

export async function getStockData() {
  noStore();
  try {
    // Nota: este endpoint adapta datos de Amplify al shape legacy usado por la UI de Inventario.
    // Evitamos N llamadas (una por producto) cargando masivamente productos y stock.
    const [productsRes, stocksRes] = await Promise.all([
      listAllPages<any>((a) => amplifyClient.models.Product.list(a)),
      listAllPages<any>((a) => amplifyClient.models.Stock.list(a)),
    ]);

    if ('error' in productsRes) return { error: productsRes.error };
    if ('error' in stocksRes) return { error: stocksRes.error };

    const stockTotalByProductId = new Map<number, number>();
    for (const s of stocksRes.data ?? []) {
      const productId = Number((s as any)?.productId);
      const qty = Number((s as any)?.quantity ?? 0);
      if (!Number.isFinite(productId) || productId <= 0) continue;
      stockTotalByProductId.set(productId, (stockTotalByProductId.get(productId) ?? 0) + (Number.isFinite(qty) ? qty : 0));
    }

    const rows: StockInfo[] = (productsRes.data ?? [])
      .map((p: any) => {
        const idProduct = Number(p?.idProduct ?? p?.productId ?? p?.id);
        const totalQty = stockTotalByProductId.get(idProduct) ?? 0;

        return {
          id: idProduct,
          name: String(p?.name ?? ''),
          code: p?.code ?? undefined,
          measurementunit: p?.measurementUnit ?? undefined,
          quantity: totalQty,
          price: Number(p?.price ?? 0),
          cost: Number(p?.cost ?? 0),
          dateupdated: p?.updatedAt ?? p?.createdAt ?? undefined,
          isenabled: Boolean(p?.isEnabled ?? true),
          istaxinclusiveprice: Boolean(p?.isTaxInclusivePrice ?? true),
        };
      })
      .filter((r: any) => Number.isFinite(r.id) && r.id > 0);

    return { data: rows };
  } catch (error: any) {
    console.error('Error al obtener el stock:', error);
    return { error: error.message || 'Error loading stock data.' };
  }
}
