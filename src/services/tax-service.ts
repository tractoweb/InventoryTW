import { amplifyClient } from '@/lib/amplify-server';

export async function listTaxes() {
  const { data, errors } = await amplifyClient.models.Tax.list();
  if (errors) throw new Error('Error al listar impuestos');
  return data ?? [];
}

export async function createTax(payload: any) {
  const { data, errors } = await amplifyClient.models.Tax.create(payload);
  if (errors) throw new Error('Error al crear impuesto');
  return data;
}
