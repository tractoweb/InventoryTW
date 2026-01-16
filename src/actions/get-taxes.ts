
'use server';

import { formatAmplifyError } from '@/lib/amplify-config';
import { cached } from "@/lib/server-cache";
import { listTaxes } from '@/services/tax-service';

export type Tax = {
  id: number;
  name: string;
  rate: number;
};

export async function getTaxes(): Promise<{ data?: Tax[], error?: string }> {
  try {
    const load = cached(
      async () => {
        const taxes = await listTaxes();
        const data: Tax[] = (taxes ?? [])
          .map((t: any) => ({
            id: Number(t?.idTax),
            name: String(t?.name ?? ''),
            rate: Number(t?.rate ?? 0),
          }))
          .filter((t) => Number.isFinite(t.id) && t.id > 0 && t.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        return { data } as const;
      },
      {
        keyParts: ["ref", "taxes"],
        revalidateSeconds: 10 * 60,
        tags: ["ref:taxes"],
      }
    );

    return await load();
  } catch (error: any) {
    return { error: formatAmplifyError(error) || 'No se pudieron cargar los impuestos.' };
  }
}
