"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";
import { revalidateTag } from "next/cache";

import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { getCurrentSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";
import { CACHE_TAGS } from "@/lib/cache-tags";

const UpdateClientSchema = z.object({
  idClient: z.coerce.number().int().min(1),
  name: z.string().min(1),
  taxNumber: z.string().optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  isEnabled: z.boolean().optional(),
  notes: z.string().optional(),
});

export type UpdateClientInput = z.input<typeof UpdateClientSchema>;

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const s = String(value);
  const trimmed = s.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function updateClientAction(raw: UpdateClientInput): Promise<{ success: boolean; error?: string }> {
  noStore();

  try {
    const parsed = UpdateClientSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "Datos inválidos" };

    const input = parsed.data;

    const beforeRes: any = await amplifyClient.models.Client.get({ idClient: Number(input.idClient) } as any);
    const before = beforeRes?.data as any;

    const payload: any = {
      idClient: input.idClient,
      name: input.name,
    };

    const taxNumber = normalizeOptionalString(input.taxNumber);
    if (taxNumber !== undefined) payload.taxNumber = taxNumber;

    const email = normalizeOptionalString(input.email);
    if (email !== undefined) payload.email = email;

    const phoneNumber = normalizeOptionalString(input.phoneNumber);
    if (phoneNumber !== undefined) payload.phoneNumber = phoneNumber;

    const address = normalizeOptionalString(input.address);
    if (address !== undefined) payload.address = address;

    const city = normalizeOptionalString(input.city);
    if (city !== undefined) payload.city = city;

    const notes = normalizeOptionalString(input.notes);
    if (notes !== undefined) payload.notes = notes;

    if (input.isEnabled !== undefined) payload.isEnabled = input.isEnabled;

    const res: any = await amplifyClient.models.Client.update(payload);
    if (res?.data) {
      const sessionRes = await getCurrentSession();
      if (sessionRes.data?.userId) {
        writeAuditLog({
          userId: sessionRes.data.userId,
          action: "UPDATE",
          tableName: "Client",
          recordId: Number(input.idClient),
          oldValues: before
            ? {
                idClient: Number(before.idClient),
                name: before.name ?? null,
                taxNumber: before.taxNumber ?? null,
                email: before.email ?? null,
                phoneNumber: before.phoneNumber ?? null,
                isEnabled: before.isEnabled ?? null,
              }
            : undefined,
          newValues: payload,
        }).catch(() => {});
      }

      revalidateTag(CACHE_TAGS.heavy.clients);
      return { success: true };
    }

    const errMsg = (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo actualizar el cliente";
    return { success: false, error: errMsg };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
