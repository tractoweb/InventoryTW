import { amplifyClient } from '@/lib/amplify-config';

export async function listDocumentCategories() {
  const { data, errors } = await amplifyClient.models.DocumentCategory.list();
  if (errors) throw new Error('Error al listar categorías de documento');
  return data ?? [];
}

export async function createDocumentCategory(payload: any) {
  const { data, errors } = await amplifyClient.models.DocumentCategory.create(payload);
  if (errors) throw new Error('Error al crear categoría de documento');
  return data;
}
