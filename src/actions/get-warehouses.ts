
'use server';

import { cached } from "@/lib/server-cache";

import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
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

        let data = (result.data ?? [])
          .map((w: any) => {
            const id = Number(w?.idWarehouse ?? w?.warehouseId ?? w?.id ?? w?.ID);
            const name = String(w?.name ?? w?.warehouseName ?? w?.title ?? "");
            return {
              idWarehouse: Number.isFinite(id) ? id : 0,
              name,
              isEnabled: (w as any)?.isEnabled !== false,
            };
          })
          .filter((w: any) => Number.isFinite(w.idWarehouse) && w.idWarehouse > 0)
          .filter((w: any) => (onlyEnabled ? w.isEnabled : true))
          .map(({ idWarehouse, name }: any) => ({ idWarehouse, name }))
          .sort((a: any, b: any) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));

        // Fallback: if Warehouses are missing/unmappable, derive from Stock so /stock can still work.
        // This keeps the UI usable and preserves traceability (stock updates still write to Kardex).
        if (!data.length) {
          try {
            const stockRes: any = await amplifyClient.models.Stock.list({ limit: 250 } as any);
            const raw = (stockRes?.data ?? []) as any[];
            const ids = Array.from(
              new Set(
                raw
                  .map((s) => Number((s as any)?.warehouseId ?? (s as any)?.warehouseID ?? (s as any)?.idWarehouse))
                  .filter((n) => Number.isFinite(n) && n > 0)
              )
            ).slice(0, 20);

            const inferred: WarehouseListItem[] = [];
            for (const idWarehouse of ids) {
              let name = `Almacén #${idWarehouse}`;
              try {
                const got: any = await amplifyClient.models.Warehouse.get({ idWarehouse } as any);
                const w = got?.data;
                if (w?.name) name = String(w.name);
              } catch {
                // ignore
              }
              inferred.push({ idWarehouse, name });
            }

            if (inferred.length) {
              data = inferred.sort((a, b) => String(a.name).localeCompare(String(b.name)));
            }
          } catch {
            // ignore
          }
        }

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
