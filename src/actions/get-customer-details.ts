"use server";

import { unstable_cache } from "next/cache";

import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type CustomerDetails = {
  idCustomer: number;
  code?: string | null;
  name: string;
  taxNumber?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryId?: number | null;
  countryName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  isEnabled?: boolean | null;
  isCustomer?: boolean | null;
  isSupplier?: boolean | null;
  dueDatePeriod?: number | null;
  isTaxExempt?: boolean | null;
};

export async function getCustomerDetails(customerId: number): Promise<{ data?: CustomerDetails; error?: string }> {
  try {
    const idCustomer = Number(customerId);
    if (!Number.isFinite(idCustomer) || idCustomer <= 0) return { error: "ID de customer inválido" };

    const keyParts = ["partners", "details", String(idCustomer)];
    const cached = unstable_cache(
      async () => {
        const res: any = await amplifyClient.models.Customer.get({ idCustomer });
        const c = res?.data as any;
        if (!c) return null;

        const countryId = c?.countryId !== undefined && c?.countryId !== null ? Number(c.countryId) : null;
        let countryName: string | null = null;
        if (countryId && Number.isFinite(countryId)) {
          const countryRes: any = await amplifyClient.models.Country.get({ idCountry: countryId } as any);
          countryName = (countryRes?.data?.name as string | undefined) ?? null;
        }

        const data: CustomerDetails = {
          idCustomer: Number(c.idCustomer),
          code: c.code ?? null,
          name: String(c.name ?? ""),
          taxNumber: c.taxNumber ?? null,
          address: c.address ?? null,
          postalCode: c.postalCode ?? null,
          city: c.city ?? null,
          countryId,
          countryName,
          email: c.email ?? null,
          phoneNumber: c.phoneNumber ?? null,
          isEnabled: c.isEnabled ?? null,
          isCustomer: c.isCustomer ?? null,
          isSupplier: c.isSupplier ?? null,
          dueDatePeriod: c.dueDatePeriod ?? null,
          isTaxExempt: c.isTaxExempt ?? null,
        };

        if (!Number.isFinite(data.idCustomer) || data.idCustomer <= 0 || !data.name) return null;
        return data;
      },
      keyParts,
      {
        revalidate: 5 * 60,
        tags: [CACHE_TAGS.heavy.customers, CACHE_TAGS.ref.countries],
      }
    );

    const data = await cached();
    if (!data) return { error: "Customer no encontrado" };

    return { data };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}
