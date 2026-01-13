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

    let data = result.data ?? [];

    if (args?.onlyEnabled) {
      data = data.filter((c: any) => c?.isEnabled !== false);
    }
    if (args?.onlySuppliers) {
      data = data.filter((c: any) => c?.isSupplier !== false);
    }

    data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return { data };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
