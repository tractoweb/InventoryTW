
'use server';

import { queryDatabase } from '@/lib/db-connection';
import { unstable_noStore as noStore } from 'next/cache';

export type ProductGroup = {
  id: number;
  name: string;
};

export async function getProductGroups(): Promise<{ data?: ProductGroup[], error?: string }> {
  // Groups don't change often, but let's not cache for now to ensure fresh data.
  noStore();
  
  try {
    const query = 'SELECT id, name FROM productgroup ORDER BY name;';
    const groups = await queryDatabase(query) as ProductGroup[];
    return { data: groups };
  } catch (error: any) {
    console.error('Error fetching product groups:', error);
    return { error: 'No se pudieron cargar las categorías de productos.' };
  }
}
