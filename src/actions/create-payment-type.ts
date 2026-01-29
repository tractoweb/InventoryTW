"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";
import { writeAuditLog } from "@/services/audit-log-service";

const CreatePaymentTypeSchema = z.object({
  name: z.string().min(1),
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

export type CreatePaymentTypeInput = z.input<typeof CreatePaymentTypeSchema>;

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const s = String(value);
  const trimmed = s.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

async function getNextPaymentTypeId(): Promise<number> {
  const result = await listAllPages<any>((args) => amplifyClient.models.PaymentType.list(args));
  if ("error" in result) throw new Error(result.error);

  let maxId = 0;
  for (const pt of (result.data ?? []) as any[]) {
    const id = Number(pt?.paymentTypeId);
    if (Number.isFinite(id) && id > maxId) maxId = id;
  }
  return maxId + 1;
}

export async function createPaymentTypeAction(raw: CreatePaymentTypeInput): Promise<{ success: boolean; error?: string }> {
  noStore();
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = CreatePaymentTypeSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const paymentTypeId = await getNextPaymentTypeId();
    const input = parsed.data;

    const payload: any = {
      paymentTypeId,
      name: input.name.trim(),
      ordinal: Number(input.ordinal ?? 0) || 0,
      isEnabled: Boolean(input.isEnabled ?? true),
      isQuickPayment: Boolean(input.isQuickPayment ?? true),
      openCashDrawer: Boolean(input.openCashDrawer ?? true),
      isChangeAllowed: Boolean(input.isChangeAllowed ?? true),
      markAsPaid: Boolean(input.markAsPaid ?? true),
      isCustomerRequired: Boolean(input.isCustomerRequired ?? false),
      isFiscal: Boolean(input.isFiscal ?? true),
      isSlipRequired: Boolean(input.isSlipRequired ?? false),
    };

    const code = normalizeOptionalString(input.code);
    if (code !== undefined) payload.code = code;

    const shortcutKey = normalizeOptionalString(input.shortcutKey);
    if (shortcutKey !== undefined) payload.shortcutKey = shortcutKey;

    const res: any = await amplifyClient.models.PaymentType.create(payload);
    if (res?.data) {
      writeAuditLog({
        userId: session.userId,
        action: "CREATE",
        tableName: "PaymentType",
        recordId: paymentTypeId,
        newValues: payload,
      }).catch(() => {});

      return { success: true };
    }

    return { success: false, error: (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo crear" };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
