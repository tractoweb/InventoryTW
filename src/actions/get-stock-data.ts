
'use server';

import { queryDatabase } from '@/lib/db-connection';
import { StockInfo } from '@/lib/types';
import { unstable_noStore as noStore } from 'next/cache';

export async function getStockData() {
  noStore();
  try {
    // Cambiamos a LEFT JOIN desde product para asegurar que todos los productos se listen,
    // incluso si no tienen una entrada en la tabla stock (stock 0).
    const query = `
      SELECT 
        p.id,
        p.name,
        p.code,
        COALESCE(s.quantity, 0) as quantity,
        p.price,
        p.cost,
        p.datecreated,
        p.dateupdated,
        w.name as warehousename
      FROM product p
      LEFT JOIN stock s ON p.id = s.productid
      LEFT JOIN warehouse w ON s.warehouseid = w.id
      WHERE p.isenabled = 1
      ORDER BY p.name, w.name;
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
