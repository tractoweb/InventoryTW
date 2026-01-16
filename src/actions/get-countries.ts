'use server';

import { formatAmplifyError } from '@/lib/amplify-config';
import { cached } from "@/lib/server-cache";
import { listCountries } from '@/services/country-service';

export type CountryListItem = {
  idCountry: number;
  name: string;
  code?: string | null;
};

export async function getCountries(): Promise<{ data: CountryListItem[]; error?: string }> {
  try {
    const load = cached(
      async () => {
        const rows = await listCountries();
        const data: CountryListItem[] = (rows ?? [])
          .map((c: any) => ({
            idCountry: Number(c?.idCountry),
            name: String(c?.name ?? ''),
            code: c?.code ?? null,
          }))
          .filter((c) => Number.isFinite(c.idCountry) && c.idCountry > 0 && c.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        return { data } as const;
      },
      {
        keyParts: ["ref", "countries"],
        revalidateSeconds: 24 * 60 * 60,
        tags: ["ref:countries"],
      }
    );

    return await load();
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
