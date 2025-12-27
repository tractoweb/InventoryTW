
'use server';

import { queryDatabase } from '@/lib/db-connection';

export type Warehouse = {
  id: number;
  name: string;
};

export async function getWarehouses(): Promise<{ data?: Warehouse[], error?: string }> {
  try {
    const query = 'SELECT id, name FROM warehouse ORDER BY name;';
    const warehouses = await queryDatabase(query) as Warehouse[];
    return { data: warehouses };
  } catch (error: any) {
    console.error('Error fetching warehouses:', error);
    return { error: 'No se pudieron cargar los almacenes.' };
  }
}
