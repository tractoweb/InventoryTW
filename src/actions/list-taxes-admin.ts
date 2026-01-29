"use server";

import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";

export type TaxAdminRow = {
  idTax: number;
  name: string;
  rate: number;
  code: string | null;
  isFixed: boolean;
  isTaxOnTotal: boolean;
  isEnabled: boolean;
};

export async function listTaxesAdminAction(): Promise<{ data: TaxAdminRow[]; error?: string }> {
  noStore();
  await requireSession(ACCESS_LEVELS.ADMIN);

  try {
    const res = await listAllPages<any>((args) => amplifyClient.models.Tax.list(args));
    if ("error" in res) return { data: [], error: res.error };

    const rows: TaxAdminRow[] = (res.data ?? [])
      .map((t: any) => ({
        idTax: Number(t?.idTax ?? 0),
        name: String(t?.name ?? ""),
        rate: Number(t?.rate ?? 0),
        code: t?.code ? String(t.code) : null,
        isFixed: Boolean(t?.isFixed ?? false),
        isTaxOnTotal: Boolean(t?.isTaxOnTotal ?? false),
        isEnabled: t?.isEnabled !== false,
      }))
      .filter((t) => Number.isFinite(t.idTax) && t.idTax > 0 && t.name.length > 0);

    rows.sort((a, b) => a.name.localeCompare(b.name));
    return { data: rows };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
