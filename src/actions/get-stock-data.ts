'use server';

import { queryDatabase } from '@/lib/db-connection';
import { StockInfo } from '@/lib/types';

export async function getStockData() {
  try {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.code,
        s.quantity,
        p.price,
        p.cost,
        p.datecreated,
        p.dateupdated,
        w.name as warehousename
      FROM stock s
      JOIN product p ON s.productid = p.id
      JOIN warehouse w ON s.warehouseid = w.id
      ORDER BY p.dateupdated DESC;
    `;
    const data = await queryDatabase(query) as any[];
    
    // Asegurarnos que todos los campos tienen un valor, especialmente los que pueden ser null
    const sanitizedData: StockInfo[] = data.map(item => ({
        id: Number(item.id),
        name: item.name ?? 'Sin Nombre',
        code: item.code ?? 'N/A',
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0,
        cost: Number(item.cost) || 0,
        datecreated: item.datecreated ? new Date(item.datecreated).toISOString() : new Date().toISOString(),
        dateupdated: item.dateupdated ? new Date(item.dateupdated).toISOString() : new Date().toISOString(),
        warehousename: item.warehousename ?? 'N/A'
    }));

    return { data: sanitizedData };
  } catch (error: any) {
    console.error('Error al obtener el stock:', error);
    return { error: error.message || 'Error al obtener datos de la base de datos.' };
  }
}
