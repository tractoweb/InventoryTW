'use server';

import { unstable_cache } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { CACHE_TAGS } from '@/lib/cache-tags';

export type CustomerSearchResult = {
  idCustomer: number;
  name: string;
  code?: string | null;
  taxNumber?: string | null;
  city?: string | null;
  countryId?: number | null;
  isEnabled?: boolean | null;
  isSupplier?: boolean | null;
  isCustomer?: boolean | null;
};

function normalizeForSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function matchesQuery(row: CustomerSearchResult, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return (
    normalizeForSearch(row.name).includes(normalizedQuery) ||
    normalizeForSearch(row.code).includes(normalizedQuery) ||
    normalizeForSearch(row.taxNumber).includes(normalizedQuery)
  );
}

export async function searchCustomersAction(
  query: string,
  limit: number = 30,
  opts?: { onlyEnabled?: boolean; onlySuppliers?: boolean; onlyCustomers?: boolean }
): Promise<{ data: CustomerSearchResult[]; error?: string }> {
  try {
    const q = String(query ?? '').trim();
    const nq = normalizeForSearch(q);

    const keyParts = [
      'partners',
      'search',
      'v2',
      q.toLowerCase(),
      String(Math.max(1, Math.trunc(Number(limit) || 30))),
      opts?.onlyEnabled ? 'enabled' : 'all',
      opts?.onlySuppliers ? 'suppliers' : 'all-sup',
      opts?.onlyCustomers ? 'customers' : 'all-cus',
    ];

    const cached = unstable_cache(
      async () => {
        // NOTE:
        // Amplify/AppSync + DynamoDB filtering can apply the filter AFTER scanning a page.
        // If we request a small `limit`, we might evaluate N items and get 0 matches even
        // though matches exist later. So we paginate until we collect enough matches.
        //
        // Also, `contains` matching can be case/diacritics sensitive depending on backend.
        // We therefore do query matching locally (case+diacritics insensitive) and only
        // keep server-side filters for coarse flags (enabled/supplier/customer).

        const and: any[] = [];

        if (opts?.onlyEnabled) {
          // include records where isEnabled is true or null/undefined
          and.push({ isEnabled: { ne: false } });
        }
        if (opts?.onlySuppliers) {
          and.push({ isSupplier: { ne: false } });
        }
        if (opts?.onlyCustomers) {
          and.push({ isCustomer: { ne: false } });
        }

        const filter = and.length === 0 ? undefined : and.length === 1 ? and[0] : { and };

        const safeLimit = Math.max(1, Math.trunc(Number(limit) || 30));
        const collected: CustomerSearchResult[] = [];

        let nextToken: string | null | undefined = undefined;
        const pageLimit = Math.min(250, Math.max(50, safeLimit));
        const maxPages = nq.length > 0 ? 200 : 80;
        let pages = 0;

        do {
          const res = (await amplifyClient.models.Customer.list({
            filter,
            limit: pageLimit,
            nextToken,
          } as any)) as any;

          if (res?.errors) return { data: [], error: 'Error al buscar clientes/proveedores' };

          const pageData = (res?.data ?? []) as any[];
          for (const c of pageData) {
            const row: CustomerSearchResult = {
              idCustomer: Number(c?.idCustomer),
              name: String(c?.name ?? ''),
              code: c?.code ?? null,
              taxNumber: c?.taxNumber ?? null,
              city: c?.city ?? null,
              countryId: c?.countryId ?? null,
              isEnabled: c?.isEnabled ?? null,
              isSupplier: c?.isSupplier ?? null,
              isCustomer: c?.isCustomer ?? null,
            };

            if (!Number.isFinite(row.idCustomer) || row.idCustomer <= 0) continue;
            if (!row.name || row.name.trim().length === 0) continue;
            if (!matchesQuery(row, nq)) continue;

            collected.push(row);
            if (collected.length >= safeLimit) break;
          }

          nextToken = res?.nextToken;
          pages++;

          if (collected.length >= safeLimit) break;
          if (pages >= maxPages) break;
        } while (nextToken);

        const out = collected.sort((a, b) => a.name.localeCompare(b.name));
        return { data: out.slice(0, safeLimit) } as const;
      },
      keyParts,
      {
        revalidate: 60,
        tags: [CACHE_TAGS.heavy.customers],
      }
    );

    return await cached();
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
