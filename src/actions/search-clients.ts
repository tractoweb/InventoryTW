'use server';

import "server-only";

import { unstable_cache } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { CACHE_TAGS } from '@/lib/cache-tags';

export type ClientSearchResult = {
  idClient: number;
  name: string;
  taxNumber?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  isEnabled?: boolean | null;
};

export async function searchClientsAction(
  query: string,
  limit: number = 30,
  opts?: { onlyEnabled?: boolean }
): Promise<{ data: ClientSearchResult[]; error?: string }> {
  try {
    const q = String(query ?? '').trim();
    const qAsNumber = Number(q);
    const isNumericQuery = q.length > 0 && Number.isFinite(qAsNumber);

    const keyParts = [
      'clients',
      'search',
      q.toLowerCase(),
      String(Math.max(1, Math.trunc(Number(limit) || 30))),
      opts?.onlyEnabled ? 'enabled' : 'all',
    ];

    const cached = unstable_cache(
      async () => {
        const and: any[] = [];
        if (q.length > 0) {
          const or: any[] = [
            { name: { contains: q } },
            { taxNumber: { contains: q } },
            { phoneNumber: { contains: q } },
            { email: { contains: q } },
          ];
          if (isNumericQuery) {
            or.push({ idClient: { eq: Math.trunc(qAsNumber) } });
          }
          and.push({ or });
        }

        if (opts?.onlyEnabled) {
          and.push({ isEnabled: { ne: false } });
        }

        const filter = and.length === 0 ? undefined : and.length === 1 ? and[0] : { and };

        const safeLimit = Math.max(1, Math.trunc(Number(limit) || 30));
        const { data, errors } = await amplifyClient.models.Client.list({
          filter,
          limit: safeLimit,
        } as any);

        if (errors) return { data: [], error: 'Error al buscar clientes' };

        const out: ClientSearchResult[] = (data ?? [])
          .map((c: any) => ({
            idClient: Number(c?.idClient),
            name: String(c?.name ?? ''),
            taxNumber: c?.taxNumber ?? null,
            phoneNumber: c?.phoneNumber ?? null,
            email: c?.email ?? null,
            isEnabled: c?.isEnabled ?? null,
          }))
          .filter((c) => Number.isFinite(c.idClient) && c.idClient > 0 && c.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        return { data: out.slice(0, safeLimit) } as const;
      },
      keyParts,
      {
        revalidate: 60,
        tags: [CACHE_TAGS.heavy.clients],
      }
    );

    return await cached();
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
