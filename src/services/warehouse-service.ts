import { amplifyClient } from '@/lib/amplify-config';

export async function listWarehouses() {
  const { data, errors } = await amplifyClient.models.Warehouse.list();
  if (errors) throw new Error('Error al listar almacenes');
  return data ?? [];
}

export async function createWarehouse(payload: any) {
  const { data, errors } = await amplifyClient.models.Warehouse.create(payload);
  if (errors) throw new Error('Error al crear almacén');
  return data;
}
