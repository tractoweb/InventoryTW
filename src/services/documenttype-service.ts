import { amplifyClient } from '@/lib/amplify-server';

export async function listDocumentTypes() {
  const { data, errors } = await amplifyClient.models.DocumentType.list();
  if (errors) throw new Error('Error al listar tipos de documento');
  return data ?? [];
}

export async function createDocumentType(payload: any) {
  const { data, errors } = await amplifyClient.models.DocumentType.create(payload);
  if (errors) throw new Error('Error al crear tipo de documento');
  return data;
}
