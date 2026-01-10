import { amplifyClient } from '@/lib/amplify-config';

export async function listPaymentTypes() {
  const { data, errors } = await amplifyClient.models.PaymentType.list();
  if (errors) throw new Error('Error al listar tipos de pago');
  return data ?? [];
}

export async function createPaymentType(payload: any) {
  const { data, errors } = await amplifyClient.models.PaymentType.create(payload);
  if (errors) throw new Error('Error al crear tipo de pago');
  return data;
}
