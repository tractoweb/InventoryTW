'use server';

import { queryDatabase } from '@/lib/db-connection';
import { unstable_noStore as noStore } from 'next/cache';

export type DocumentSearchResult = {
    id: number;
    number: string;
    customername: string | null;
};

export async function searchDocuments(searchTerm: string) {
  // Search should always be live
  noStore();
  
  if (!searchTerm) {
    return { data: [] };
  }

  try {
    const query = `
      SELECT 
        d.id,
        d.number,
        c.name as customername
      FROM document d
      LEFT JOIN customer c ON d.customerid = c.id
      WHERE d.number LIKE ? OR c.name LIKE ?
      ORDER BY d.date DESC
      LIMIT 10;
    `;
    const params = [`%${searchTerm}%`, `%${searchTerm}%`];
    const data = await queryDatabase(query, params) as any[];

    const sanitizedData: DocumentSearchResult[] = data.map(item => ({
        id: Number(item.id),
        number: item.number,
        customername: item.customername || 'N/A'
    }));

    return { data: sanitizedData };
  } catch (error: any) {
    console.error('Error searching documents:', error);
    return { error: error.message || 'Error al buscar documentos en la base de datos.' };
  }
}
