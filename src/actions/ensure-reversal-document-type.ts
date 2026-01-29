'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import {
  ACCESS_LEVELS,
  DOCUMENT_STOCK_DIRECTION,
  formatAmplifyError,
  isStockDirectionIn,
  isStockDirectionOut,
} from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-server';
import { allocateCounterRange, ensureCounterAtLeast } from '@/lib/allocate-counter-range';
import { requireSession } from '@/lib/session';
import { listAllPages } from '@/services/amplify-list-all';
import { writeAuditLog } from '@/services/audit-log-service';

const InputSchema = z.object({
  documentTypeId: z.coerce.number().int().positive(),
});

export type EnsureReversalDocumentTypeInput = z.input<typeof InputSchema>;

async function seedCounterFromExistingMax(counterName: string) {
  const all = await listAllPages<any>((args) => amplifyClient.models.DocumentType.list(args));
  if ('error' in all) {
    const msg = typeof (all as any).error === 'string' ? (all as any).error : 'Error leyendo tipos de documento';
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
    const [candidate] = await allocateCounterRange('documentTypeId', 1);
    const existing = await amplifyClient.models.DocumentType.get({ documentTypeId: candidate } as any);
    if (!(existing as any)?.data) return candidate;

    await seedCounterFromExistingMax('documentTypeId');
  }
  throw new Error('No se pudo asignar un documentTypeId libre');
}

function oppositeStockDirection(sd: number): number {
  if (isStockDirectionIn(sd)) return DOCUMENT_STOCK_DIRECTION.OUT;
  if (isStockDirectionOut(sd)) return DOCUMENT_STOCK_DIRECTION.IN;
  return DOCUMENT_STOCK_DIRECTION.NONE;
}

export async function ensureReversalDocumentTypeAction(
  raw: EnsureReversalDocumentTypeInput
): Promise<{ success: boolean; documentTypeId?: number; created?: boolean; error?: string }> {
  noStore();

  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos inválidos' };

  try {
    const originalRes: any = await amplifyClient.models.DocumentType.get({ documentTypeId: Number(parsed.data.documentTypeId) } as any);
    const original = originalRes?.data as any;
    if (!original) return { success: false, error: 'Tipo de documento no encontrado' };

    const warehouseId = Number(original.warehouseId);
    const categoryId = Number(original.documentCategoryId);
    const origSd = Number(original.stockDirection ?? 0) || 0;
    const targetSd = oppositeStockDirection(origSd);

    if (targetSd === DOCUMENT_STOCK_DIRECTION.NONE) {
      return { success: false, error: 'Este tipo de documento no impacta stock; no requiere reverso.' };
    }

    const existingForWarehouse = await listAllPages<any>((args) =>
      amplifyClient.models.DocumentType.list({
        ...args,
        filter: {
          and: [
            { warehouseId: { eq: warehouseId } },
            { documentCategoryId: { eq: categoryId } },
            { stockDirection: { eq: targetSd } },
          ],
        },
      } as any)
    );

    if (!('error' in existingForWarehouse)) {
      const rows = existingForWarehouse.data ?? [];
      function score(dt: any): number {
        const name = String(dt?.name ?? '').toLowerCase();
        const code = String(dt?.code ?? '').toLowerCase();
        const pt = String(dt?.printTemplate ?? '').toLowerCase();
        let s = 0;
        if (name.includes('anul')) s += 50;
        if (name.includes('rever') || name.includes('revers')) s += 40;
        if (code.includes('rev') || code.includes('anu')) s += 10;
        if (pt === String(original?.printTemplate ?? '').toLowerCase() && pt.length > 0) s += 5;
        return s;
      }

      const best = rows.map((dt: any) => ({ dt, s: score(dt) })).sort((a, b) => b.s - a.s)[0]?.dt;
      const id = Number(best?.documentTypeId);
      if (best && Number.isFinite(id) && id > 0) {
        return { success: true, documentTypeId: id, created: false };
      }

      // If there are rows but none scored, pick first valid.
      const fallback = rows.find((dt: any) => Number(dt?.documentTypeId) > 0);
      if (fallback) {
        return { success: true, documentTypeId: Number(fallback.documentTypeId), created: false };
      }
    }

    // Create a reversal doc type
    const documentTypeId = await allocateFreeDocumentTypeId();

    const origName = String(original?.name ?? '').trim();
    const origCode = String(original?.code ?? '').trim();
    const reversalName = origName ? `Anulación ${origName}` : 'Anulación';
    const reversalCode = origCode ? `${origCode}-REV` : 'REV';

    const payload: any = {
      documentTypeId,
      name: reversalName,
      code: reversalCode,
      documentCategoryId: categoryId,
      warehouseId,
      stockDirection: targetSd,
      editorType: Number(original?.editorType ?? 0) || 0,
      printTemplate: original?.printTemplate ?? null,
      priceType: Number(original?.priceType ?? 0) || 0,
      languageKey: original?.languageKey ?? null,
    };

    const created: any = await amplifyClient.models.DocumentType.create(payload as any);
    if (!created?.data) {
      const msg = (created?.errors?.[0]?.message as string | undefined) ?? 'No se pudo crear el tipo de documento reverso';
      return { success: false, error: msg };
    }

    writeAuditLog({
      userId: session.userId,
      action: 'CREATE',
      tableName: 'DocumentType',
      recordId: documentTypeId,
      newValues: {
        ...payload,
        sourceDocumentTypeId: Number(original.documentTypeId),
      },
    }).catch(() => {});

    return { success: true, documentTypeId, created: true };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
