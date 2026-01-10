import { amplifyClient } from '@/lib/amplify-config';

export async function listCurrencies() {
  const { data, errors } = await amplifyClient.models.Currency.list();
  if (errors) throw new Error('Error al listar monedas');
  return data ?? [];
}

export async function createCurrency({ idCurrency, name, code }: { idCurrency: number; name: string; code: string }) {
  const { data, errors } = await amplifyClient.models.Currency.create({ idCurrency, name, code });
  if (errors) throw new Error('Error al crear moneda');
  return data;
}
