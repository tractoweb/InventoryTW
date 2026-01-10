
import { inventoryService } from '@/services/inventory-service';
import { Product } from '@/lib/types';
import { unstable_noStore as noStore } from 'next/cache';

export async function getStockData() {
  noStore();
  try {
    // Aquí deberías obtener los productos reales, ajusta según tu servicio
    const result = await inventoryService.searchProducts("");
    const data: Product[] = result.products || [];
    return { data };
  } catch (error: any) {
    console.error('Error al obtener el stock:', error);
    return { error: error.message || 'Error loading stock data.' };
  }
}
