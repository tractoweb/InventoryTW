import { amplifyClient } from '@/lib/amplify-config';

export async function listProductGroups() {
  const { data, errors } = await amplifyClient.models.ProductGroup.list();
  if (errors) throw new Error('Error al listar grupos');
  return data ?? [];
}

export async function createProductGroup({ idProductGroup, name, parentGroupId, color, image, rank }: { idProductGroup: number; name: string; parentGroupId?: number; color?: string; image?: string; rank?: number }) {
  const { data, errors } = await amplifyClient.models.ProductGroup.create({ idProductGroup, name, parentGroupId, color, image, rank });
  if (errors) throw new Error('Error al crear grupo');
  return data;
}
