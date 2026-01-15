"use server";
import { unstable_noStore as noStore } from 'next/cache';
import { formatAmplifyError } from '@/lib/amplify-config';
import { listProductGroups } from '@/services/product-group-service';

export type ProductGroup = {
  id: number;
  name: string;
};

export async function getProductGroups(): Promise<{ data?: ProductGroup[], error?: string }> {
  // Groups don't change often, but let's not cache for now to ensure fresh data.
  noStore();
  
  try {
    const groups = await listProductGroups();
    const data: ProductGroup[] = (groups ?? [])
      .map((g: any) => ({
        id: Number(g?.idProductGroup),
        name: String(g?.name ?? ''),
      }))
      .filter((g) => Number.isFinite(g.id) && g.id > 0 && g.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { data };
  } catch (error: any) {
    return { error: formatAmplifyError(error) || 'No se pudieron cargar los grupos.' };
  }
}
