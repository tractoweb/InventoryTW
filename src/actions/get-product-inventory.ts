'use server';

import { queryDatabase } from '@/lib/db-connection';
import { ProductInventory } from '@/lib/types';
import { unstable_noStore as noStore } from 'next/cache';

export async function getProductInventory() {
  noStore();
  
  try {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.code,
        p.measurementunit,
        p.price,
        p.dateupdated,
        (SELECT SUM(s.quantity) FROM stock s WHERE s.productid = p.id) AS totalstock
      FROM product p
      ORDER BY p.dateupdated DESC;
    `;
    const data = await queryDatabase(query) as ProductInventory[];
    
    // Asegurarnos que todos los campos tienen un valor, especialmente los que pueden ser null
    const sanitizedData = data.map(item => ({
        ...item,
        id: Number(item.id),
        code: item.code ?? 'N/A',
        measurementunit: item.measurementunit ?? 'Unidad',
        totalstock: item.totalstock ?? 0,
        price: Number(item.price) || 0,
        dateupdated: item.dateupdated ? new Date(item.dateupdated).toISOString() : new Date().toISOString(),
    }));

    return { data: sanitizedData };
  } catch (error: any) {
    console.error('Error al obtener el inventario de productos:', error);
    return { error: error.message || 'Error al obtener datos de la base de datos.' };
  }
}
