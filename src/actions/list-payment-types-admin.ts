"use server";

import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";

export type PaymentTypeAdminRow = {
  paymentTypeId: number;
  name: string;
  code: string | null;
  ordinal: number;
  isEnabled: boolean;
  isQuickPayment: boolean;
  openCashDrawer: boolean;
  isChangeAllowed: boolean;
  markAsPaid: boolean;
  isCustomerRequired: boolean;
  isFiscal: boolean;
  isSlipRequired: boolean;
  shortcutKey: string | null;
};

export async function listPaymentTypesAdminAction(): Promise<{ data: PaymentTypeAdminRow[]; error?: string }> {
  noStore();
  await requireSession(ACCESS_LEVELS.ADMIN);

  try {
    const res = await listAllPages<any>((args) => amplifyClient.models.PaymentType.list(args));
    if ("error" in res) return { data: [], error: res.error };

    const rows: PaymentTypeAdminRow[] = (res.data ?? [])
      .map((pt: any) => ({
        paymentTypeId: Number(pt?.paymentTypeId ?? 0),
        name: String(pt?.name ?? ""),
        code: pt?.code ? String(pt.code) : null,
        ordinal: Number(pt?.ordinal ?? 0) || 0,
        isEnabled: pt?.isEnabled !== false,
        isQuickPayment: pt?.isQuickPayment !== false,
        openCashDrawer: pt?.openCashDrawer !== false,
        isChangeAllowed: pt?.isChangeAllowed !== false,
        markAsPaid: pt?.markAsPaid !== false,
        isCustomerRequired: Boolean(pt?.isCustomerRequired ?? false),
        isFiscal: pt?.isFiscal !== false,
        isSlipRequired: Boolean(pt?.isSlipRequired ?? false),
        shortcutKey: pt?.shortcutKey ? String(pt.shortcutKey) : null,
      }))
      .filter((pt) => Number.isFinite(pt.paymentTypeId) && pt.paymentTypeId > 0 && pt.name.length > 0);

    rows.sort((a, b) => {
      const ord = (a.ordinal ?? 0) - (b.ordinal ?? 0);
      if (ord !== 0) return ord;
      return a.name.localeCompare(b.name);
    });

    return { data: rows };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
