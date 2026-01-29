"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";

const ListSoftDeletedProductsSchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
  nextToken: z.string().nullable().optional(),
});

export type SoftDeletedProductRow = {
  id: number;
  name: string;
  code: string | null;
  updatedAt: string | null;
  createdAt: string | null;
};

export async function listSoftDeletedProductsAction(raw?: z.input<typeof ListSoftDeletedProductsSchema>): Promise<{
  data: SoftDeletedProductRow[];
  nextToken: string | null;
  error?: string;
}> {
  noStore();

  await requireSession(ACCESS_LEVELS.MASTER);

  const parsed = ListSoftDeletedProductsSchema.safeParse(raw ?? {});
  if (!parsed.success) return { data: [], nextToken: null, error: "Datos inválidos" };

  try {
    const qRaw = String(parsed.data.q ?? "").trim();
    const limit = parsed.data.limit;
    const nextToken = parsed.data.nextToken ?? undefined;

    const baseFilter: any = { isEnabled: { eq: false } };

    const filter: any = qRaw.length
      ? {
          and: [
            baseFilter,
            {
              or: [
                { name: { contains: qRaw } },
                { code: { contains: qRaw } },
              ],
            },
          ],
        }
      : baseFilter;

    const res: any = await amplifyClient.models.Product.list({
      filter,
      limit,
      nextToken,
    } as any);

    const rows: SoftDeletedProductRow[] = ((res?.data ?? []) as any[])
      .map((p: any) => ({
        id: Number(p?.idProduct ?? 0),
        name: String(p?.name ?? ""),
        code: p?.code ? String(p.code) : null,
        createdAt: p?.createdAt ? String(p.createdAt) : null,
        updatedAt: p?.updatedAt ? String(p.updatedAt) : null,
      }))
      .filter((r) => Number.isFinite(r.id) && r.id > 0 && r.name.length > 0);

    return { data: rows, nextToken: (res?.nextToken ?? null) as string | null };
  } catch (error) {
    return { data: [], nextToken: null, error: formatAmplifyError(error) };
  }
}
