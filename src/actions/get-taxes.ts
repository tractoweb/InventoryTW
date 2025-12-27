
'use server';

import { queryDatabase } from '@/lib/db-connection';

export type Tax = {
  id: number;
  name: string;
  rate: number;
};

export async function getTaxes(): Promise<{ data?: Tax[], error?: string }> {
  try {
    const query = 'SELECT id, name, rate FROM tax WHERE isenabled = 1 ORDER BY name;';
    const taxes = await queryDatabase(query) as Tax[];
    return { data: taxes };
  } catch (error: any) {
    console.error('Error fetching taxes:', error);
    return { error: 'No se pudieron cargar los impuestos.' };
  }
}
