import { amplifyClient } from '@/lib/amplify-config';

export async function listCompanies() {
  const { data, errors } = await amplifyClient.models.Company.list();
  if (errors) throw new Error('Error al listar empresas');
  return data ?? [];
}

export async function createCompany(payload: any) {
  const { data, errors } = await amplifyClient.models.Company.create(payload);
  if (errors) throw new Error('Error al crear empresa');
  return data;
}
