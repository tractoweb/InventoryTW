"use server";

import { unstable_cache } from "next/cache";
import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { listAllPages } from "@/services/amplify-list-all";

export type CustomerListItem = {
  idCustomer: number;
  name: string;
  taxNumber?: string | null;
  isEnabled?: boolean | null;
  isSupplier?: boolean | null;
  isCustomer?: boolean | null;
};

export async function getCustomers(args?: { onlyEnabled?: boolean; onlySuppliers?: boolean }) {
  try {
    const onlyEnabled = Boolean(args?.onlyEnabled);
    const onlySuppliers = Boolean(args?.onlySuppliers);

    const keyParts = ["partners", "list", onlyEnabled ? "enabled" : "all", onlySuppliers ? "suppliers" : "all-suppliers"];
    const cached = unstable_cache(
      async () => {
        const result = await listAllPages<CustomerListItem>((listArgs) => amplifyClient.models.Customer.list(listArgs));
        if ("error" in result) return { data: [], error: result.error };

        const data = (result.data ?? []) as any[];
        let normalized: CustomerListItem[] = data
          .map((c) => ({
            idCustomer: Number(c?.idCustomer),
            name: String(c?.name ?? ""),
            taxNumber: c?.taxNumber ?? null,
            isEnabled: c?.isEnabled ?? null,
            isSupplier: c?.isSupplier ?? null,
            isCustomer: c?.isCustomer ?? null,
          }))
          .filter((c) => Number.isFinite(c.idCustomer) && c.idCustomer > 0 && c.name.length > 0);

        if (onlyEnabled) normalized = normalized.filter((c) => c?.isEnabled !== false);
        if (onlySuppliers) normalized = normalized.filter((c) => c?.isSupplier !== false);

        normalized.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        return { data: normalized } as const;
      },
      keyParts,
      { revalidate: 60, tags: [CACHE_TAGS.heavy.customers] }
    );

    return await cached();
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
