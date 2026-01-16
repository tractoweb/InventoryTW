
'use server';

import { cached } from "@/lib/server-cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

export type WarehouseListItem = {
  idWarehouse: number;
  name: string;
};

// Backwards-compat alias (existing UI imports this name)
export type Warehouse = WarehouseListItem;

export async function getWarehouses(args?: { onlyEnabled?: boolean }): Promise<{ data?: WarehouseListItem[]; error?: string }> {
  try {
    const onlyEnabled = Boolean(args?.onlyEnabled ?? false);

    const load = cached(
      async () => {
        const result = await listAllPages<WarehouseListItem>((listArgs) =>
          amplifyClient.models.Warehouse.list(listArgs)
        );

        if ("error" in result) return { data: [] as WarehouseListItem[], error: result.error };

        const data = (result.data ?? [])
          .map((w: any) => ({
            idWarehouse: Number(w?.idWarehouse),
            name: String(w?.name ?? ""),
            isEnabled: w?.isEnabled !== false,
          }))
          .filter((w: any) => Number.isFinite(w.idWarehouse) && w.idWarehouse > 0)
          .filter((w: any) => (onlyEnabled ? w.isEnabled : true))
          .map(({ idWarehouse, name }: any) => ({ idWarehouse, name }))
          .sort((a: any, b: any) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));

        return { data };
      },
      {
        keyParts: ["ref", "warehouses", onlyEnabled ? "enabled" : "all"],
        // Warehouses change rarely; cache to reduce AppSync calls.
        revalidateSeconds: 10 * 60,
        tags: ["ref:warehouses"],
      }
    );

    return await load();
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
