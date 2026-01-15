"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";

const UpdateCustomerSchema = z.object({
  idCustomer: z.coerce.number().int().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  taxNumber: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryId: z.coerce.number().optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  dueDatePeriod: z.coerce.number().int().min(0).optional(),
  isTaxExempt: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  isCustomer: z.boolean().optional(),
});

export type UpdateCustomerInput = z.input<typeof UpdateCustomerSchema>;

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const s = String(value);
  const trimmed = s.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function updateCustomerAction(raw: UpdateCustomerInput): Promise<{ success: boolean; error?: string }> {
  noStore();

  try {
    const parsed = UpdateCustomerSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "Datos inválidos" };

    const input = parsed.data;

    const beforeRes: any = await amplifyClient.models.Customer.get({ idCustomer: Number(input.idCustomer) } as any);
    const before = beforeRes?.data as any;

    const payload: any = {
      idCustomer: input.idCustomer,
      name: input.name,
    };

    const code = normalizeOptionalString(input.code);
    if (code !== undefined) payload.code = code;

    const taxNumber = normalizeOptionalString(input.taxNumber);
    if (taxNumber !== undefined) payload.taxNumber = taxNumber;

    const address = normalizeOptionalString(input.address);
    if (address !== undefined) payload.address = address;

    const postalCode = normalizeOptionalString(input.postalCode);
    if (postalCode !== undefined) payload.postalCode = postalCode;

    const city = normalizeOptionalString(input.city);
    if (city !== undefined) payload.city = city;

    if (input.countryId !== undefined && Number.isFinite(Number(input.countryId))) payload.countryId = Number(input.countryId);

    const email = normalizeOptionalString(input.email);
    if (email !== undefined) payload.email = email;

    const phoneNumber = normalizeOptionalString(input.phoneNumber);
    if (phoneNumber !== undefined) payload.phoneNumber = phoneNumber;

    if (input.dueDatePeriod !== undefined) payload.dueDatePeriod = input.dueDatePeriod;
    if (input.isTaxExempt !== undefined) payload.isTaxExempt = input.isTaxExempt;
    if (input.isEnabled !== undefined) payload.isEnabled = input.isEnabled;
    if (input.isSupplier !== undefined) payload.isSupplier = input.isSupplier;
    if (input.isCustomer !== undefined) payload.isCustomer = input.isCustomer;

    const res: any = await amplifyClient.models.Customer.update(payload);
    if (res?.data) {
      const sessionRes = await getCurrentSession();
      if (sessionRes.data?.userId) {
        writeAuditLog({
          userId: sessionRes.data.userId,
          action: "UPDATE",
          tableName: "Customer",
          recordId: Number(input.idCustomer),
          oldValues: before
            ? {
                idCustomer: Number(before.idCustomer),
                name: before.name ?? null,
                code: before.code ?? null,
                taxNumber: before.taxNumber ?? null,
                isEnabled: before.isEnabled ?? null,
                isSupplier: before.isSupplier ?? null,
                isCustomer: before.isCustomer ?? null,
              }
            : undefined,
          newValues: payload,
        }).catch(() => {});
      }

      return { success: true };
    }

    const errMsg = (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo actualizar el customer";
    return { success: false, error: errMsg };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
