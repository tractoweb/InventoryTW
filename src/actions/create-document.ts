'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';
import { revalidateTag } from "next/cache";

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { ACCESS_LEVELS } from '@/lib/amplify-config';
import { allocateCounterRange, ensureCounterAtLeast } from '@/lib/allocate-counter-range';
import { ymdToBogotaMidnightUtc } from '@/lib/datetime';
import { requireSession } from '@/lib/session';
import { listAllPages } from '@/services/amplify-list-all';
import { writeAuditLog } from '@/services/audit-log-service';
import { createDocument } from '@/services/document-service';
import { CACHE_TAGS } from "@/lib/cache-tags";

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
  clientId: z.coerce.number().optional(),
  clientName: z.string().optional(),
  warehouseId: z.coerce.number().min(1),
  documentTypeId: z.coerce.number().min(1),
  date: z.string().min(1), // YYYY-MM-DD
  paidStatus: z.coerce.number().int().min(0).max(2).optional(),
  idempotencyKey: z.string().optional(),
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
    const session = await requireSession(ACCESS_LEVELS.CASHIER);

    const parsed = CreateDocumentInputSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: 'Datos inválidos' };
    }

    const input = parsed.data;

    // Resolve category: use supplier for purchases, client for sales.
    let categoryId = 0;
    try {
      const dtRes: any = await amplifyClient.models.DocumentType.get({ documentTypeId: Number(input.documentTypeId) } as any);
      const dt = dtRes?.data as any;
      categoryId = Number(dt?.documentCategoryId ?? 0) || 0;
    } catch {
      categoryId = 0;
    }

    const clientNameTrimmed = input.clientName !== undefined ? String(input.clientName).trim() : '';

    const supplierId = categoryId === 2 ? undefined : input.customerId;
    const clientId = input.clientId !== undefined ? Number(input.clientId) : undefined;
    const clientNameSnapshot =
      categoryId === 2
        ? (clientNameTrimmed.length > 0 ? clientNameTrimmed : 'Anónimo')
        : clientNameTrimmed.length > 0
          ? clientNameTrimmed
          : undefined;

    const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey).trim() : '';
    if (idempotencyKey) {
      try {
        const existing: any = await amplifyClient.models.Document.list({
          filter: { idempotencyKey: { eq: idempotencyKey } },
          limit: 1,
        } as any);
        const found = Array.isArray(existing?.data) ? existing.data[0] : null;
        if (found) {
          return {
            success: true,
            documentId: Number(found.documentId),
            documentNumber: String(found.number ?? ''),
          };
        }
      } catch {
        // Backwards compatibility: older backend schemas may not yet expose `idempotencyKey`.
        // In that case, proceed without the idempotency pre-check.
      }
    }

    const referenceDocumentNumber = input.referenceDocumentNumber ? String(input.referenceDocumentNumber).trim() : '';
    if (referenceDocumentNumber) {
      const existing: any = await amplifyClient.models.Document.list({
        filter: { referenceDocumentNumber: { eq: referenceDocumentNumber } },
        limit: 1,
      } as any);
      const found = Array.isArray(existing?.data) ? existing.data[0] : null;
      if (found) {
        return {
          success: false,
          error: `Ya existe un documento con la referencia: ${referenceDocumentNumber}`,
        };
      }
    }

    // Allocate IDs
    const documentId = await allocateFreeDocumentId();
    const itemIds = await allocateFreeDocumentItemIds(input.items.length);

    const date = ymdToBogotaMidnightUtc(input.date);

    const result = await createDocument({
      documentId,
      userId: session.userId,
      customerId: supplierId,
      clientId,
      clientNameSnapshot,
      orderNumber: input.orderNumber,
      documentTypeId: input.documentTypeId,
      warehouseId: input.warehouseId,
      date,
      paidStatus: input.paidStatus,
      idempotencyKey: idempotencyKey || undefined,
      referenceDocumentNumber: referenceDocumentNumber || undefined,
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

    // Best-effort audit trail
    writeAuditLog({
      userId: session.userId,
      action: 'CREATE',
      tableName: 'Document',
      recordId: documentId,
      newValues: {
        documentId,
        documentNumber: result.documentNumber,
        supplierId: supplierId ?? null,
        clientId: clientId ?? null,
        clientNameSnapshot: clientNameSnapshot ?? null,
        warehouseId: input.warehouseId,
        documentTypeId: input.documentTypeId,
        date: input.date,
        paidStatus: input.paidStatus ?? 0,
        itemsCount: input.items.length,
      },
    }).catch(() => {});

    revalidateTag(CACHE_TAGS.heavy.documents);
    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
    revalidateTag(CACHE_TAGS.heavy.stockData);

    return {
      success: true,
      documentId,
      documentNumber: result.documentNumber,
    };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
