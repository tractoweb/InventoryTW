"use server";

import { unstable_noStore as noStore } from "next/cache";
import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
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
  noStore();

  try {
    const result = await listAllPages<CustomerListItem>((listArgs) =>
      amplifyClient.models.Customer.list(listArgs)
    );

    if ("error" in result) return { data: [], error: result.error };

    let data = (result.data ?? []) as any[];

    // Normalize to plain objects (Amplify models include non-serializable function fields)
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

    if (args?.onlyEnabled) {
      normalized = normalized.filter((c) => c?.isEnabled !== false);
    }
    if (args?.onlySuppliers) {
      normalized = normalized.filter((c) => c?.isSupplier !== false);
    }

    normalized.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return { data: normalized };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
