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

export async function updateProductGroup({
  idProductGroup,
  name,
  parentGroupId,
  color,
  image,
  rank,
}: {
  idProductGroup: number;
  name?: string;
  parentGroupId?: number | null;
  color?: string | null;
  image?: string | null;
  rank?: number | null;
}) {
  const { data, errors } = await amplifyClient.models.ProductGroup.update({
    idProductGroup,
    name,
    parentGroupId,
    color,
    image,
    rank,
  } as any);
  if (errors) throw new Error('Error al actualizar grupo');
  return data;
}

export async function deleteProductGroup({ idProductGroup }: { idProductGroup: number }) {
  const { data, errors } = await amplifyClient.models.ProductGroup.delete({ idProductGroup } as any);
  if (errors) throw new Error('Error al eliminar grupo');
  return data;
}
