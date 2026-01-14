'use server';

import { unstable_noStore as noStore } from 'next/cache';

import { formatAmplifyError } from '@/lib/amplify-config';
import { listCountries } from '@/services/country-service';

export type CountryListItem = {
  idCountry: number;
  name: string;
  code?: string | null;
};

export async function getCountries(): Promise<{ data: CountryListItem[]; error?: string }> {
  noStore();

  try {
    const rows = await listCountries();
    const data: CountryListItem[] = (rows ?? [])
      .map((c: any) => ({
        idCountry: Number(c?.idCountry),
        name: String(c?.name ?? ''),
        code: c?.code ?? null,
      }))
      .filter((c) => Number.isFinite(c.idCountry) && c.idCountry > 0 && c.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { data };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
