
import { inventoryService } from '@/services/inventory-service';
import type { StockInfo } from '@/lib/types';
import { unstable_noStore as noStore } from 'next/cache';
import { amplifyClient } from '@/lib/amplify-config';

export async function getStockData() {
  noStore();
  try {
    // Nota: este endpoint adapta datos de Amplify al shape legacy usado por la UI de Inventario.
    const result = await inventoryService.searchProducts("");
    const products = (result.products || []) as any[];

    const rows: StockInfo[] = [];

    for (const p of products) {
      const idProduct = Number(p?.idProduct ?? p?.productId ?? p?.id);
      const { data: stocks } = await amplifyClient.models.Stock.list({
        filter: { productId: { eq: idProduct } },
      });

      const totalQty = (stocks ?? []).reduce((sum: number, s: any) => sum + Number(s?.quantity ?? 0), 0);

      rows.push({
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
      });
    }

    return { data: rows };
  } catch (error: any) {
    console.error('Error al obtener el stock:', error);
    return { error: error.message || 'Error loading stock data.' };
  }
}
