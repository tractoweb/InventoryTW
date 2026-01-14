'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { allocateCounterRange, ensureCounterAtLeast } from '@/lib/allocate-counter-range';
import { ymdToBogotaMidnightUtc } from '@/lib/datetime';
import { listAllPages } from '@/services/amplify-list-all';
import { createDocument } from '@/services/document-service';

async function seedCounterFromExistingMax(counterName: string, entity: 'Document' | 'DocumentItem') {
  const all =
    entity === 'Document'
      ? await listAllPages<any>((args) => amplifyClient.models.Document.list(args))
      : await listAllPages<any>((args) => amplifyClient.models.DocumentItem.list(args));

  if ('error' in all) {
    const msg = typeof (all as any).error === 'string' ? (all as any).error : 'Error leyendo datos existentes';
    throw new Error(msg);
  }

  const maxExistingId = all.data.reduce((max, row: any) => {
    const raw = entity === 'Document' ? row?.documentId : row?.documentItemId;
    const id = Number(raw ?? 0);
    return Number.isFinite(id) ? Math.max(max, id) : max;
  }, 0);

  await ensureCounterAtLeast(counterName, maxExistingId);
}

async function allocateFreeDocumentId(): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const [candidate] = await allocateCounterRange('documentId', 1);
    const existing = await amplifyClient.models.Document.get({ documentId: candidate } as any);
    if (!(existing as any)?.data) return candidate;

    // Counter is stale (likely due to imported data). Fast-forward once and retry.
    await seedCounterFromExistingMax('documentId', 'Document');
  }
  throw new Error('No se pudo asignar un documentId libre');
}

async function allocateFreeDocumentItemIds(count: number): Promise<number[]> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidates = await allocateCounterRange('documentItemId', count);
    const checks = await Promise.all(
      candidates.map((id) => amplifyClient.models.DocumentItem.get({ documentItemId: id } as any))
    );

    const anyExists = checks.some((r: any) => Boolean(r?.data));
    if (!anyExists) return candidates;

    await seedCounterFromExistingMax('documentItemId', 'DocumentItem');
  }
  throw new Error('No se pudo asignar documentItemId(s) libres');
}

const DocumentItemInputSchema = z.object({
  productId: z.coerce.number().min(1),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().min(0),
  productCost: z.coerce.number().min(0).optional(),
});

const CreateDocumentInputSchema = z.object({
  userId: z.coerce.number().min(1).default(1),
  customerId: z.coerce.number().optional(),
  warehouseId: z.coerce.number().min(1),
  documentTypeId: z.coerce.number().min(1),
  date: z.string().min(1), // YYYY-MM-DD
  referenceDocumentNumber: z.string().optional(),
  note: z.string().optional(),
  internalNote: z.string().optional(),
  orderNumber: z.string().optional(),
  items: z.array(DocumentItemInputSchema).min(1),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentInputSchema>;

export async function createDocumentAction(raw: CreateDocumentInput): Promise<{ success: boolean; documentId?: number; documentNumber?: string; error?: string }> {
  noStore();

  try {
    const parsed = CreateDocumentInputSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: 'Datos inválidos' };
    }

    const input = parsed.data;

    // Allocate IDs
    const documentId = await allocateFreeDocumentId();
    const itemIds = await allocateFreeDocumentItemIds(input.items.length);

    const date = ymdToBogotaMidnightUtc(input.date);

    const result = await createDocument({
      documentId,
      userId: input.userId,
      customerId: input.customerId,
      orderNumber: input.orderNumber,
      documentTypeId: input.documentTypeId,
      warehouseId: input.warehouseId,
      date,
      referenceDocumentNumber: input.referenceDocumentNumber,
      note: input.note,
      internalNote: input.internalNote,
      items: input.items.map((it, idx) => ({
        documentItemId: itemIds[idx],
        productId: it.productId,
        quantity: it.quantity,
        price: it.price,
        productCost: it.productCost,
      })),
    } as any);

    if (!result.success) {
      return { success: false, error: result.error || 'No se pudo crear el documento' };
    }

    return {
      success: true,
      documentId,
      documentNumber: result.documentNumber,
    };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
