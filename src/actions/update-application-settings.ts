"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";

const UpdateApplicationSettingsSchema = z.object({
  companyId: z.coerce.number().int().positive(),
  organizationName: z.string().optional(),
  organizationLogo: z.string().optional(),
  primaryColor: z.string().optional(),
  currencySymbol: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
  taxPercentage: z.coerce.number().min(0).max(100).optional(),
  allowNegativeStock: z.coerce.boolean().optional(),
  defaultWarehouseId: z.coerce.number().int().positive().optional(),
});

export type UpdateApplicationSettingsInput = z.input<typeof UpdateApplicationSettingsSchema>;

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const s = String(value);
  const trimmed = s.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function updateApplicationSettingsAction(
  raw: UpdateApplicationSettingsInput
): Promise<{ success: boolean; error?: string }> {
  noStore();
  await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = UpdateApplicationSettingsSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const input = parsed.data;

    const payload: any = {
      companyId: input.companyId,
    };

    const organizationName = normalizeOptionalString(input.organizationName);
    if (organizationName !== undefined) payload.organizationName = organizationName;

    const organizationLogo = normalizeOptionalString(input.organizationLogo);
    if (organizationLogo !== undefined) payload.organizationLogo = organizationLogo;

    const primaryColor = normalizeOptionalString(input.primaryColor);
    if (primaryColor !== undefined) payload.primaryColor = primaryColor;

    const currencySymbol = normalizeOptionalString(input.currencySymbol);
    if (currencySymbol !== undefined) payload.currencySymbol = currencySymbol;

    const dateFormat = normalizeOptionalString(input.dateFormat);
    if (dateFormat !== undefined) payload.dateFormat = dateFormat;

    const timeFormat = normalizeOptionalString(input.timeFormat);
    if (timeFormat !== undefined) payload.timeFormat = timeFormat;

    if (input.taxPercentage !== undefined) payload.taxPercentage = Number(input.taxPercentage);
    if (input.allowNegativeStock !== undefined) payload.allowNegativeStock = Boolean(input.allowNegativeStock);
    if (input.defaultWarehouseId !== undefined) payload.defaultWarehouseId = Number(input.defaultWarehouseId);

    payload.lastModifiedDate = new Date().toISOString();

    const res: any = await amplifyClient.models.ApplicationSettings.update(payload);
    if (res?.data) return { success: true };

    const msg = (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo guardar settings";
    return { success: false, error: msg };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
