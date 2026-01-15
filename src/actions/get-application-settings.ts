"use server";

import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { amplifyClient } from "@/lib/amplify-config";

export type ApplicationSettingsDto = {
  companyId: number;
  organizationName: string | null;
  organizationLogo: string | null;
  primaryColor: string | null;
  currencySymbol: string | null;
  dateFormat: string | null;
  timeFormat: string | null;
  taxPercentage: number | null;
  allowNegativeStock: boolean;
  defaultWarehouseId: number | null;
};

function normalizeDto(s: any, companyId: number): ApplicationSettingsDto {
  return {
    companyId,
    organizationName: s?.organizationName ?? null,
    organizationLogo: s?.organizationLogo ?? null,
    primaryColor: s?.primaryColor ?? null,
    currencySymbol: s?.currencySymbol ?? null,
    dateFormat: s?.dateFormat ?? null,
    timeFormat: s?.timeFormat ?? null,
    taxPercentage: s?.taxPercentage !== undefined && s?.taxPercentage !== null ? Number(s.taxPercentage) : null,
    allowNegativeStock: Boolean(s?.allowNegativeStock ?? false),
    defaultWarehouseId:
      s?.defaultWarehouseId !== undefined && s?.defaultWarehouseId !== null ? Number(s.defaultWarehouseId) : null,
  };
}

export async function getApplicationSettings(args?: {
  companyId?: number;
}): Promise<{ data?: ApplicationSettingsDto; error?: string }> {
  noStore();
  await requireSession(ACCESS_LEVELS.ADMIN);

  const companyId = Number(args?.companyId ?? 1);
  if (!Number.isFinite(companyId) || companyId <= 0) return { error: "companyId inválido" };

  try {
    const res: any = await amplifyClient.models.ApplicationSettings.get({ companyId } as any);
    if (res?.data) return { data: normalizeDto(res.data, companyId) };

    // Create defaults if missing
    const created: any = await amplifyClient.models.ApplicationSettings.create({
      companyId,
      primaryColor: "#1f2937",
      currencySymbol: "$",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "HH:mm:ss",
      taxPercentage: 19,
      allowNegativeStock: false,
    } as any);

    if (created?.data) return { data: normalizeDto(created.data, companyId) };

    return { error: "No se pudieron cargar settings" };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}
