'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import {
  ACCESS_LEVELS,
  amplifyClient,
  DOCUMENT_STOCK_DIRECTION,
  formatAmplifyError,
  normalizeStockDirection,
} from '@/lib/amplify-config';
import { allocateCounterRange, ensureCounterAtLeast } from '@/lib/allocate-counter-range';
import { requireSession } from '@/lib/session';
import { listAllPages } from '@/services/amplify-list-all';
import { writeAuditLog } from '@/services/audit-log-service';

const InputSchema = z.object({
  warehouseId: z.coerce.number().int().positive(),
  kind: z.enum(['purchase', 'sale']),
});

export type EnsurePassThroughDocumentTypeInput = z.input<typeof InputSchema>;

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

export async function ensurePassThroughDocumentTypeAction(
  raw: EnsurePassThroughDocumentTypeInput
): Promise<{ success: boolean; documentTypeId?: number; created?: boolean; error?: string }> {
  noStore();

  const session = await requireSession(ACCESS_LEVELS.CASHIER);

  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos inválidos' };

  const warehouseId = Number(parsed.data.warehouseId);
  const kind = parsed.data.kind;

  try {
    const categoryId = kind === 'sale' ? 2 : 1;

    const existing = await listAllPages<any>((args) =>
      amplifyClient.models.DocumentType.list({
        ...args,
        filter: {
          and: [
            { warehouseId: { eq: warehouseId } },
            { documentCategoryId: { eq: categoryId } },
            { stockDirection: { eq: DOCUMENT_STOCK_DIRECTION.NONE } },
          ],
        },
      } as any)
    );

    if ('error' in existing) {
      return { success: false, error: existing.error };
    }

    const rows = existing.data ?? [];

    const preferred = rows
      .map((dt: any) => {
        const name = String(dt?.name ?? '').toLowerCase();
        const code = String(dt?.code ?? '').toLowerCase();
        const sd = normalizeStockDirection(dt?.stockDirection);

        let score = 0;
        if (sd === DOCUMENT_STOCK_DIRECTION.NONE) score += 50;
        if (name.includes('sin inventario')) score += 30;
        if (name.includes('compra') && kind === 'purchase') score += 10;
        if (name.includes('venta') && kind === 'sale') score += 10;
        if (code === (kind === 'sale' ? '320' : '310')) score += 10;

        return { dt, score };
      })
      .sort((a, b) => b.score - a.score)[0]?.dt;

    if (preferred) {
      const id = Number(preferred.documentTypeId);
      if (Number.isFinite(id) && id > 0) {
        return { success: true, documentTypeId: id, created: false };
      }
    }

    const documentTypeId = await allocateFreeDocumentTypeId();

    const payload = {
      documentTypeId,
      name: kind === 'sale' ? 'Venta sin inventario' : 'Compra sin inventario',
      code: kind === 'sale' ? '320' : '310',
      documentCategoryId: categoryId,
      warehouseId,
      stockDirection: DOCUMENT_STOCK_DIRECTION.NONE,
      editorType: 0,
      printTemplate: kind === 'sale' ? 'Sale' : 'Purchase',
      priceType: kind === 'sale' ? 1 : 0,
      languageKey: kind === 'sale' ? 'Document.Category.Sales.Sales' : 'Document.Category.Purchases.Purchases',
    };

    const created: any = await amplifyClient.models.DocumentType.create(payload as any);
    if (!created?.data) {
      const msg = (created?.errors?.[0]?.message as string | undefined) ?? 'No se pudo crear el tipo de documento';
      return { success: false, error: msg };
    }

    writeAuditLog({
      userId: session.userId,
      action: 'CREATE',
      tableName: 'DocumentType',
      recordId: documentTypeId,
      newValues: payload,
    }).catch(() => {});

    return { success: true, documentTypeId, created: true };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
