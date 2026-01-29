"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";
import { revalidateTag } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";
import { writeAuditLog } from "@/services/audit-log-service";
import { CACHE_TAGS } from "@/lib/cache-tags";

const CreateTaxSchema = z.object({
  name: z.string().min(1),
  rate: z.coerce.number().min(0).max(1000),
  code: z.string().optional(),
  isFixed: z.coerce.boolean().optional(),
  isTaxOnTotal: z.coerce.boolean().optional(),
  isEnabled: z.coerce.boolean().optional(),
});

export type CreateTaxInput = z.input<typeof CreateTaxSchema>;

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const s = String(value);
  const trimmed = s.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

async function getNextTaxId(): Promise<number> {
  const result = await listAllPages<any>((args) => amplifyClient.models.Tax.list(args));
  if ("error" in result) throw new Error(result.error);

  let maxId = 0;
  for (const t of (result.data ?? []) as any[]) {
    const id = Number(t?.idTax);
    if (Number.isFinite(id) && id > maxId) maxId = id;
  }
  return maxId + 1;
}

export async function createTaxAction(raw: CreateTaxInput): Promise<{ success: boolean; error?: string }> {
  noStore();
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = CreateTaxSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const idTax = await getNextTaxId();
    const input = parsed.data;

    const payload: any = {
      idTax,
      name: input.name.trim(),
      rate: Number(input.rate),
      isFixed: Boolean(input.isFixed ?? false),
      isTaxOnTotal: Boolean(input.isTaxOnTotal ?? false),
      isEnabled: Boolean(input.isEnabled ?? true),
    };

    const code = normalizeOptionalString(input.code);
    if (code !== undefined) payload.code = code;

    const res: any = await amplifyClient.models.Tax.create(payload);
    if (res?.data) {
      revalidateTag(CACHE_TAGS.ref.taxes);
      revalidateTag(CACHE_TAGS.heavy.dashboardOverview);

      writeAuditLog({
        userId: session.userId,
        action: "CREATE",
        tableName: "Tax",
        recordId: idTax,
        newValues: payload,
      }).catch(() => {});

      return { success: true };
    }

    return { success: false, error: (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo crear" };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
