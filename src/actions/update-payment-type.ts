"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";

const UpdatePaymentTypeSchema = z.object({
  paymentTypeId: z.coerce.number().int().positive(),
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  ordinal: z.coerce.number().int().min(0).optional(),
  isEnabled: z.coerce.boolean().optional(),
  isQuickPayment: z.coerce.boolean().optional(),
  openCashDrawer: z.coerce.boolean().optional(),
  isChangeAllowed: z.coerce.boolean().optional(),
  markAsPaid: z.coerce.boolean().optional(),
  isCustomerRequired: z.coerce.boolean().optional(),
  isFiscal: z.coerce.boolean().optional(),
  isSlipRequired: z.coerce.boolean().optional(),
  shortcutKey: z.string().optional(),
});

export type UpdatePaymentTypeInput = z.input<typeof UpdatePaymentTypeSchema>;

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const s = String(value);
  const trimmed = s.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function updatePaymentTypeAction(
  raw: UpdatePaymentTypeInput
): Promise<{ success: boolean; error?: string }> {
  noStore();
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = UpdatePaymentTypeSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const input = parsed.data;

    const beforeRes: any = await amplifyClient.models.PaymentType.get({ paymentTypeId: Number(input.paymentTypeId) } as any);
    const before = beforeRes?.data as any;

    const payload: any = { paymentTypeId: Number(input.paymentTypeId) };

    if (input.name !== undefined) payload.name = String(input.name).trim();
    if (input.ordinal !== undefined) payload.ordinal = Number(input.ordinal) || 0;

    const code = normalizeOptionalString(input.code);
    if (code !== undefined) payload.code = code;

    const shortcutKey = normalizeOptionalString(input.shortcutKey);
    if (shortcutKey !== undefined) payload.shortcutKey = shortcutKey;

    if (input.isEnabled !== undefined) payload.isEnabled = Boolean(input.isEnabled);
    if (input.isQuickPayment !== undefined) payload.isQuickPayment = Boolean(input.isQuickPayment);
    if (input.openCashDrawer !== undefined) payload.openCashDrawer = Boolean(input.openCashDrawer);
    if (input.isChangeAllowed !== undefined) payload.isChangeAllowed = Boolean(input.isChangeAllowed);
    if (input.markAsPaid !== undefined) payload.markAsPaid = Boolean(input.markAsPaid);
    if (input.isCustomerRequired !== undefined) payload.isCustomerRequired = Boolean(input.isCustomerRequired);
    if (input.isFiscal !== undefined) payload.isFiscal = Boolean(input.isFiscal);
    if (input.isSlipRequired !== undefined) payload.isSlipRequired = Boolean(input.isSlipRequired);

    const res: any = await amplifyClient.models.PaymentType.update(payload);
    if (res?.data) {
      writeAuditLog({
        userId: session.userId,
        action: "UPDATE",
        tableName: "PaymentType",
        recordId: Number(input.paymentTypeId),
        oldValues: before
          ? {
              paymentTypeId: Number(before.paymentTypeId),
              name: before.name ?? null,
              code: before.code ?? null,
              ordinal: before.ordinal ?? null,
              isEnabled: before.isEnabled ?? null,
              isQuickPayment: before.isQuickPayment ?? null,
              openCashDrawer: before.openCashDrawer ?? null,
              isChangeAllowed: before.isChangeAllowed ?? null,
              markAsPaid: before.markAsPaid ?? null,
              isCustomerRequired: before.isCustomerRequired ?? null,
              isFiscal: before.isFiscal ?? null,
              isSlipRequired: before.isSlipRequired ?? null,
              shortcutKey: before.shortcutKey ?? null,
            }
          : undefined,
        newValues: payload,
      }).catch(() => {});

      return { success: true };
    }

    return { success: false, error: (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo actualizar" };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
