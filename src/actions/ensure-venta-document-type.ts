"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import {
  ACCESS_LEVELS,
  DOCUMENT_STOCK_DIRECTION,
  formatAmplifyError,
  normalizeStockDirection,
} from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { allocateCounterRange, ensureCounterAtLeast } from "@/lib/allocate-counter-range";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";
import { writeAuditLog } from "@/services/audit-log-service";

const InputSchema = z.object({
  warehouseId: z.coerce.number().int().positive(),
});

export type EnsureVentaDocumentTypeInput = z.input<typeof InputSchema>;

async function seedCounterFromExistingMax(counterName: string) {
  const all = await listAllPages<any>((args) => amplifyClient.models.DocumentType.list(args));
  if ("error" in all) {
    const msg = typeof (all as any).error === "string" ? (all as any).error : "Error leyendo tipos de documento";
    throw new Error(msg);
  }

  const maxExistingId = (all.data ?? []).reduce((max: number, row: any) => {
    const id = Number(row?.documentTypeId ?? 0);
    return Number.isFinite(id) ? Math.max(max, id) : max;
  }, 0);

  await ensureCounterAtLeast(counterName, maxExistingId);
}

async function allocateFreeDocumentTypeId(): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const [candidate] = await allocateCounterRange("documentTypeId", 1);
    const existing = await amplifyClient.models.DocumentType.get({ documentTypeId: candidate } as any);
    if (!(existing as any)?.data) return candidate;

    // Counter is stale (likely imported data). Fast-forward and retry.
    await seedCounterFromExistingMax("documentTypeId");
  }
  throw new Error("No se pudo asignar un documentTypeId libre");
}

async function ensureSaleTemplateRecord(): Promise<void> {
  // Best-effort: store a "Sale" template definition in the Templates table.
  // Rendering is still code-driven; this record makes the template discoverable.
  try {
    const name = "Sale";
    const existing: any = await amplifyClient.models.Template.get({ name } as any);
    if (existing?.data) return;

    await amplifyClient.models.Template.create({
      name,
      value: JSON.stringify({
        kind: "Sale",
        version: 1,
        description: "Plantilla PDF para documentos de venta (POS)",
      }),
    } as any);
  } catch {
    // ignore
  }
}

export async function ensureVentaDocumentTypeAction(
  raw: EnsureVentaDocumentTypeInput
): Promise<{ success: boolean; documentTypeId?: number; created?: boolean; error?: string }> {
  noStore();

  const session = await requireSession(ACCESS_LEVELS.CASHIER);

  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  const warehouseId = Number(parsed.data.warehouseId);

  try {
    // 1) Find an existing "Venta" doc type for this warehouse.
    // Prefer the explicit template key "Sale", then conventional Sales/Invoice types.
    const existingForWarehouse = await listAllPages<any>((args) =>
      amplifyClient.models.DocumentType.list({
        ...args,
        filter: {
          warehouseId: { eq: warehouseId },
          documentCategoryId: { eq: 2 }, // Sales
        },
      } as any)
    );

    if ("error" in existingForWarehouse) {
      return { success: false, error: existingForWarehouse.error };
    }

    const rows = existingForWarehouse.data ?? [];

    function score(dt: any): number {
      const pt = String(dt?.printTemplate ?? "").trim();
      const name = String(dt?.name ?? "").trim();
      const code = String(dt?.code ?? "").trim();
      const sd = normalizeStockDirection(dt?.stockDirection);

      let s = 0;
      if (pt === "Sale") s += 100;
      if (name.toLowerCase() === "sales" || name.toLowerCase() === "venta") s += 50;
      if (code === "200" || code.toLowerCase() === "ven" || code.toLowerCase() === "venta") s += 10;
      if (sd === DOCUMENT_STOCK_DIRECTION.OUT) s += 20;
      return s;
    }

    const bestExisting = rows
      .map((dt: any) => ({ dt, s: score(dt) }))
      .sort((a, b) => b.s - a.s)[0]?.dt;

    if (bestExisting && score(bestExisting) >= 50) {
      const id = Number(bestExisting?.documentTypeId);
      if (Number.isFinite(id) && id > 0) {
        // Best-effort: normalize printTemplate to "Sale" if it is an OUT sales doc type.
        const sd = normalizeStockDirection(bestExisting?.stockDirection);
        if (sd === DOCUMENT_STOCK_DIRECTION.OUT && String(bestExisting?.printTemplate ?? "").trim() !== "Sale") {
          amplifyClient.models.DocumentType.update({
            documentTypeId: id,
            printTemplate: "Sale",
          } as any).catch(() => {});
        }

        await ensureSaleTemplateRecord();
        return { success: true, documentTypeId: id, created: false };
      }
    }

    // 2) Create one.
    const documentTypeId = await allocateFreeDocumentTypeId();

    const payload = {
      documentTypeId,
      name: "Sales",
      code: "200",
      documentCategoryId: 2,
      warehouseId,
      stockDirection: DOCUMENT_STOCK_DIRECTION.OUT,
      editorType: 0,
      printTemplate: "Sale",
      priceType: 1,
      languageKey: "Document.Category.Sales.Sales",
    };

    const created: any = await amplifyClient.models.DocumentType.create(payload as any);
    if (!created?.data) {
      const msg = (created?.errors?.[0]?.message as string | undefined) ?? "No se pudo crear el tipo de documento";
      return { success: false, error: msg };
    }

    ensureSaleTemplateRecord().catch(() => {});

    writeAuditLog({
      userId: session.userId,
      action: "CREATE",
      tableName: "DocumentType",
      recordId: documentTypeId,
      newValues: payload,
    }).catch(() => {});

    return { success: true, documentTypeId, created: true };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
