"use server";

import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { amplifyClient } from "@/lib/amplify-config";

export async function getPosSaleConfigAction(args?: {
  companyId?: number;
}): Promise<{ data?: { taxPercentage: number }; error?: string }> {
  noStore();

  // POS is used by CASHIER, so allow that level.
  await requireSession(ACCESS_LEVELS.CASHIER);

  const companyId = Number(args?.companyId ?? 1);
  if (!Number.isFinite(companyId) || companyId <= 0) return { error: "companyId inválido" };

  try {
    const res: any = await amplifyClient.models.ApplicationSettings.get({ companyId } as any);
    const taxPercentageRaw = res?.data?.taxPercentage;
    const taxPercentage = Number(taxPercentageRaw ?? 19);

    return {
      data: {
        taxPercentage: Number.isFinite(taxPercentage) ? Math.max(0, Math.min(100, taxPercentage)) : 19,
      },
    };
  } catch (e) {
    // Do not hard-fail POS if settings aren't readable for some reason.
    return { data: { taxPercentage: 19 }, error: formatAmplifyError(e) };
  }
}
