"use server";
import { formatAmplifyError } from '@/lib/amplify-config';
import { cached } from "@/lib/server-cache";
import { listProductGroups } from '@/services/product-group-service';

export type ProductGroup = {
  id: number;
  name: string;
};

export async function getProductGroups(): Promise<{ data?: ProductGroup[], error?: string }> {
  try {
    const load = cached(
      async () => {
        const groups = await listProductGroups();
        const data: ProductGroup[] = (groups ?? [])
          .map((g: any) => ({
            id: Number(g?.idProductGroup),
            name: String(g?.name ?? ''),
          }))
          .filter((g) => Number.isFinite(g.id) && g.id > 0 && g.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        return { data } as const;
      },
      {
        keyParts: ["ref", "product-groups"],
        revalidateSeconds: 10 * 60,
        tags: ["ref:product-groups"],
      }
    );

    return await load();
  } catch (error: any) {
    return { error: formatAmplifyError(error) || 'No se pudieron cargar los grupos.' };
  }
}
