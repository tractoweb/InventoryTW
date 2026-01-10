
import { inventoryService } from '@/services/inventory-service';
import { unstable_noStore as noStore } from 'next/cache';



export async function getProductDetails(productId: number) {
  // Siempre obtener datos frescos
  noStore();
  
  if (!productId) {
    return { error: 'Product ID is required.' };
  }

  try {
    // Convertir el ID a string para el servicio
    const data = await inventoryService.getProductDetails(String(productId));
    return { data };

  } catch (error: any) {
    console.error(`Error obteniendo detalles para el producto ${productId}:`, error);
    return { error: error.message || 'Error al obtener detalles del producto.' };
  }
}

