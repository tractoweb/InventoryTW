"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";
import { writeAuditLog } from "@/services/audit-log-service";

const CompanySchema = z.object({
  idCompany: z.coerce.number().int().positive().optional(),
  name: z.string().min(1),
  taxNumber: z.string().optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryId: z.coerce.number().int().positive().optional(),
  bankAccountNumber: z.string().optional(),
  bankDetails: z.string().optional(),
  logo: z.string().optional(),
});

export type UpsertCompanyInput = z.input<typeof CompanySchema>;

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const s = String(value);
  const trimmed = s.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

async function getNextCompanyId(): Promise<number> {
  const result = await listAllPages<any>((args) => amplifyClient.models.Company.list(args));
  if ("error" in result) throw new Error(result.error);

  let maxId = 0;
  for (const c of (result.data ?? []) as any[]) {
    const id = Number(c?.idCompany);
    if (Number.isFinite(id) && id > maxId) maxId = id;
  }
  return maxId + 1;
}

export async function upsertCompanyAction(raw: UpsertCompanyInput): Promise<{ success: boolean; idCompany?: number; error?: string }> {
  noStore();
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = CompanySchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const input = parsed.data;

    const idCompany = input.idCompany ? Number(input.idCompany) : await getNextCompanyId();

    const payload: any = {
      idCompany,
      name: input.name.trim(),
    };

    const taxNumber = normalizeOptionalString(input.taxNumber);
    if (taxNumber !== undefined) payload.taxNumber = taxNumber;

    const email = normalizeOptionalString(input.email);
    if (email !== undefined) payload.email = email;

    const phoneNumber = normalizeOptionalString(input.phoneNumber);
    if (phoneNumber !== undefined) payload.phoneNumber = phoneNumber;

    const address = normalizeOptionalString(input.address);
    if (address !== undefined) payload.address = address;

    const postalCode = normalizeOptionalString(input.postalCode);
    if (postalCode !== undefined) payload.postalCode = postalCode;

    const city = normalizeOptionalString(input.city);
    if (city !== undefined) payload.city = city;

    if (input.countryId !== undefined) payload.countryId = Number(input.countryId);

    const bankAccountNumber = normalizeOptionalString(input.bankAccountNumber);
    if (bankAccountNumber !== undefined) payload.bankAccountNumber = bankAccountNumber;

    const bankDetails = normalizeOptionalString(input.bankDetails);
    if (bankDetails !== undefined) payload.bankDetails = bankDetails;

    const logo = normalizeOptionalString(input.logo);
    if (logo !== undefined) payload.logo = logo;

    const beforeRes: any = await amplifyClient.models.Company.get({ idCompany } as any);
    const before = beforeRes?.data as any;

    const res: any = before ? await amplifyClient.models.Company.update(payload) : await amplifyClient.models.Company.create(payload);

    if (res?.data) {
      writeAuditLog({
        userId: session.userId,
        action: before ? "UPDATE" : "CREATE",
        tableName: "Company",
        recordId: idCompany,
        oldValues: before
          ? {
              idCompany: Number(before.idCompany),
              name: before.name ?? null,
              taxNumber: before.taxNumber ?? null,
              email: before.email ?? null,
              phoneNumber: before.phoneNumber ?? null,
              address: before.address ?? null,
              postalCode: before.postalCode ?? null,
              city: before.city ?? null,
              countryId: before.countryId ?? null,
              bankAccountNumber: before.bankAccountNumber ?? null,
              bankDetails: before.bankDetails ?? null,
              logo: before.logo ?? null,
            }
          : undefined,
        newValues: payload,
      }).catch(() => {});

      return { success: true, idCompany };
    }

    return { success: false, error: (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo guardar" };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
