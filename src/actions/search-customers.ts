'use server';

import { unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';

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

export async function searchCustomersAction(
  query: string,
  limit: number = 30,
  opts?: { onlyEnabled?: boolean; onlySuppliers?: boolean; onlyCustomers?: boolean }
): Promise<{ data: CustomerSearchResult[]; error?: string }> {
  noStore();

  try {
    const q = String(query ?? '').trim();

    const and: any[] = [];
    if (q.length > 0) {
      and.push({
        or: [{ name: { contains: q } }, { code: { contains: q } }, { taxNumber: { contains: q } }],
      });
    }

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

    const { data, errors } = await amplifyClient.models.Customer.list({
      filter,
      limit,
    } as any);

    if (errors) return { data: [], error: 'Error al buscar proveedores' };

    const out: CustomerSearchResult[] = (data ?? [])
      .map((c: any) => ({
        idCustomer: Number(c?.idCustomer),
        name: String(c?.name ?? ''),
        code: c?.code ?? null,
        taxNumber: c?.taxNumber ?? null,
        city: c?.city ?? null,
        countryId: c?.countryId ?? null,
        isEnabled: c?.isEnabled ?? null,
        isSupplier: c?.isSupplier ?? null,
        isCustomer: c?.isCustomer ?? null,
      }))
      .filter((c) => Number.isFinite(c.idCustomer) && c.idCustomer > 0 && c.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { data: out.slice(0, limit) };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
