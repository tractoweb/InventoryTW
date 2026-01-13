
'use server';

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

export type WarehouseListItem = {
  idWarehouse: number;
  name: string;
};

// Backwards-compat alias (existing UI imports this name)
export type Warehouse = WarehouseListItem;

export async function getWarehouses(args?: { onlyEnabled?: boolean }): Promise<{ data?: WarehouseListItem[]; error?: string }> {
  noStore();

  try {
    const result = await listAllPages<WarehouseListItem>((listArgs) =>
      amplifyClient.models.Warehouse.list(listArgs)
    );

    if ("error" in result) return { data: [], error: result.error };

    const data = (result.data ?? [])
      .map((w: any) => ({
        idWarehouse: Number(w?.idWarehouse),
        name: String(w?.name ?? ""),
      }))
      .filter((w: any) => Number.isFinite(w.idWarehouse) && w.idWarehouse > 0)
      .sort((a: any, b: any) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));

    return { data };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
