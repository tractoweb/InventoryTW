'use server';

import { z } from 'zod';
import { unstable_noStore as noStore, revalidateTag } from 'next/cache';

import { ACCESS_LEVELS, DOCUMENT_STOCK_DIRECTION, formatAmplifyError } from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-server';
import { requireSession } from '@/lib/session';
import { listAllPages } from '@/services/amplify-list-all';
import { finalizeDocument } from '@/services/document-service';
import { createDocumentAction } from '@/actions/create-document';
import { ensureReversalDocumentTypeAction } from '@/actions/ensure-reversal-document-type';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { writeAuditLog } from '@/services/audit-log-service';
import { BOGOTA_TIME_ZONE } from '@/lib/datetime';

const InputSchema = z.object({
  documentId: z.coerce.number().min(1),
  reason: z.string().optional(),
  confirmProceedWithZeroStock: z.coerce.boolean().optional(),
});

function safeJsonParse(value: unknown): any | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildOriginalVoidLinkageInternalNote(prevInternalNote: unknown, next: { reversalDocumentId: number; reversalDocumentNumber: string; reason?: string | null }) {
  const parsed = safeJsonParse(prevInternalNote);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const nowIso = new Date().toISOString();
  return JSON.stringify({
    ...parsed,
    void: {
      ...(typeof (parsed as any).void === 'object' && (parsed as any).void ? (parsed as any).void : {}),
      reversalDocumentId: Number(next.reversalDocumentId),
      reversalDocumentNumber: String(next.reversalDocumentNumber),
      reason: next.reason ? String(next.reason) : undefined,
      at: nowIso,
    },
  });
}

function bogotaYmd(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const y = map.year ?? String(now.getUTCFullYear());
  const m = map.month ?? String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = map.day ?? String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function voidDocumentAction(
  raw: z.input<typeof InputSchema>
): Promise<
  | { success: true; reversalDocumentId?: number; reversalDocumentNumber?: string }
  | {
      success: false;
      error?: string;
      needsConfirmation?: boolean;
      confirmCode?: 'ZERO_STOCK_CLAMP';
      affectedProducts?: Array<{
        productId: number;
        name?: string;
        code?: string;
        stock: number;
        required: number;
      }>;
      message?: string;
    }
> {
  noStore();

  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos inválidos' };

  try {
    const documentId = Number(parsed.data.documentId);
    const reason = String(parsed.data.reason ?? '').trim();
    const confirmProceedWithZeroStock = Boolean(parsed.data.confirmProceedWithZeroStock);

    const docRes: any = await amplifyClient.models.Document.get({ documentId } as any);
    const doc = docRes?.data as any;
    if (!doc) return { success: false, error: 'Documento no encontrado' };

    if (!Boolean(doc.isClockedOut)) {
      return { success: false, error: 'Este documento no está finalizado. Usa Eliminar o Modificar.' };
    }

    const dtRes: any = await amplifyClient.models.DocumentType.get({ documentTypeId: Number(doc.documentTypeId) } as any);
    const dt = dtRes?.data as any;
    const stockDirection = Number(dt?.stockDirection ?? 0) || 0;

    if (stockDirection === DOCUMENT_STOCK_DIRECTION.NONE) {
      // No stock impact: mark as voided via note only.
      const prevNote = String(doc.note ?? '').trim();
      const stamp = `ANULADO ${new Date().toISOString()}${reason ? ` · Motivo: ${reason}` : ''}`;
      const nextNote = prevNote ? `${prevNote}\n${stamp}` : stamp;

      await amplifyClient.models.Document.update({ documentId, note: nextNote } as any);

      writeAuditLog({
        userId: session.userId,
        action: 'VOID',
        tableName: 'Document',
        recordId: documentId,
        newValues: { documentId, note: nextNote },
      }).catch(() => {});

      revalidateTag(CACHE_TAGS.heavy.documents);
      revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
      revalidateTag(CACHE_TAGS.heavy.stockData);

      return { success: true };
    }

    // Load items
    const itemsRes = await listAllPages<any>((args) => amplifyClient.models.DocumentItem.list(args), {
      filter: { documentId: { eq: Number(documentId) } },
    });
    if ('error' in itemsRes) return { success: false, error: itemsRes.error };

    const items = (itemsRes.data ?? []).map((it: any) => ({
      productId: Number(it?.productId),
      quantity: Number(it?.quantity ?? 0) || 0,
      price: Number(it?.price ?? 0) || 0,
      productCost: Number(it?.productCost ?? 0) || 0,
    }));

    const safeItems = items
      .filter((it) => Number.isFinite(it.productId) && it.productId > 0 && Number.isFinite(it.quantity) && it.quantity > 0)
      .map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        price: Math.max(0, it.price),
        productCost: Math.max(0, it.productCost),
      }));

    if (safeItems.length === 0) {
      return { success: false, error: 'El documento no tiene ítems válidos para reversar.' };
    }

    // If original is ENTRADA, reversal is SALIDA and may reduce stock.
    // In test stages, we want to avoid going negative and instead allow clamping to 0 with user confirmation.
    const willReverseAsOut = stockDirection === DOCUMENT_STOCK_DIRECTION.IN;
    let clampMeta:
      | {
          mode: 'CLAMP_TO_ZERO';
          warehouseId: number;
          products: Array<{ productId: number; stock: number; required: number }>;
        }
      | null = null;

    if (willReverseAsOut) {
      const productIdsToCheck = Array.from(new Set(safeItems.map((i) => Number(i.productId)).filter((id) => Number.isFinite(id) && id > 0)));

      const stocksRes: any = await amplifyClient.models.Stock.list({
        filter: {
          and: [
            { warehouseId: { eq: Number(doc.warehouseId) } },
            { or: productIdsToCheck.map((pid) => ({ productId: { eq: pid } })) },
          ],
        },
        limit: 500,
      } as any);

      const currentByProduct = new Map<number, number>();
      for (const s of (stocksRes?.data ?? []) as any[]) {
        const pid = Number((s as any)?.productId);
        if (!Number.isFinite(pid) || pid <= 0) continue;
        currentByProduct.set(pid, Number((s as any)?.quantity ?? 0) || 0);
      }

      const requiredByProduct = new Map<number, number>();
      for (const it of safeItems) {
        const pid = Number(it.productId);
        const q = Math.abs(Number(it.quantity) || 0);
        if (!Number.isFinite(pid) || pid <= 0 || !(q > 0)) continue;
        requiredByProduct.set(pid, (requiredByProduct.get(pid) ?? 0) + q);
      }

      const affected: Array<{ productId: number; stock: number; required: number }> = [];
      for (const pid of productIdsToCheck) {
        const current = currentByProduct.get(pid) ?? 0;
        const required = requiredByProduct.get(pid) ?? 0;
        const next = current - required;
        // Warn when reversal would make stock negative (test data / manual review).
        if (next < 0) {
          affected.push({ productId: pid, stock: current, required });
        }
      }

      if (affected.length && !confirmProceedWithZeroStock) {
        const productGets = await Promise.all(
          affected.map((a) => amplifyClient.models.Product.get({ idProduct: Number(a.productId) } as any))
        );
        const enriched = affected.map((a, idx) => {
          const p = (productGets[idx] as any)?.data as any;
          return {
            productId: a.productId,
            name: p?.name ? String(p.name) : undefined,
            code: p?.code ? String(p.code) : undefined,
            stock: a.stock,
            required: a.required,
          };
        });

        return {
          success: false,
          needsConfirmation: true,
          confirmCode: 'ZERO_STOCK_CLAMP',
          affectedProducts: enriched,
          message:
            'Al anular este documento, algunos productos tienen stock insuficiente y el reverso intentaría dejarlos en negativo (incluye casos con stock en 0).\n\nRevisa el stock manualmente. Si continúas (modo prueba), la anulación seguirá, pero el sistema NO dejará el stock en negativo: se ajustará a 0.',
        };
      }

      if (affected.length && confirmProceedWithZeroStock) {
        clampMeta = {
          mode: 'CLAMP_TO_ZERO',
          warehouseId: Number(doc.warehouseId),
          products: affected,
        };
      }
    }

    // Ensure reversal doc type (same category/warehouse, opposite stockDirection)
    const ensureRes: any = await ensureReversalDocumentTypeAction({ documentTypeId: Number(doc.documentTypeId) });
    if (!ensureRes?.success || !ensureRes?.documentTypeId) {
      return { success: false, error: String(ensureRes?.error ?? 'No se pudo resolver el tipo de anulación') };
    }

    const parsedNote = safeJsonParse(doc.internalNote);
    const posClientName =
      typeof parsedNote?.customer?.name === 'string' && parsedNote.customer.name.trim().length > 0
        ? String(parsedNote.customer.name).trim()
        : null;

    const clientNameSnapshot =
      typeof doc.clientNameSnapshot === 'string' && String(doc.clientNameSnapshot).trim().length > 0
        ? String(doc.clientNameSnapshot).trim()
        : null;

    const clientName = clientNameSnapshot ?? posClientName ?? 'Anónimo';

    const voidInternalNote = {
      source: 'SYSTEM',
      kind: 'VOID',
      version: 1,
      createdAt: new Date().toISOString(),
      reason: reason || undefined,
      ...(clampMeta ? { clamp: clampMeta } : {}),
      original: {
        documentId: Number(doc.documentId ?? documentId),
        number: String(doc.number ?? ''),
        documentTypeId: Number(doc.documentTypeId),
        warehouseId: Number(doc.warehouseId),
      },
    };

    const idempotencyKey = `void-${Number(doc.documentId ?? documentId)}`;

    const createRes: any = await createDocumentAction({
      warehouseId: Number(doc.warehouseId),
      documentTypeId: Number(ensureRes.documentTypeId),
      date: bogotaYmd(),
      idempotencyKey,
      referenceDocumentNumber: `VOID:${String(doc.number ?? documentId)}`,
      note: `ANULACIÓN de ${String(doc.number ?? documentId)}${reason ? ` · Motivo: ${reason}` : ''}`,
      internalNote: JSON.stringify(voidInternalNote),
      customerId: doc.customerId !== undefined && doc.customerId !== null ? Number(doc.customerId) : undefined,
      clientId: doc.clientId !== undefined && doc.clientId !== null ? Number(doc.clientId) : undefined,
      clientName,
      items: safeItems,
    } as any);

    if (!createRes?.success || !createRes?.documentId) {
      return { success: false, error: String(createRes?.error ?? 'No se pudo crear el documento de anulación') };
    }

    const reversalDocumentId = Number(createRes.documentId);
    const reversalDocumentNumber = String(createRes.documentNumber ?? reversalDocumentId);

    const fin = await finalizeDocument(reversalDocumentId, String(session.userId), {
      clampNegativeStockToZero: stockDirection === DOCUMENT_STOCK_DIRECTION.IN && confirmProceedWithZeroStock,
    });
    if (!fin?.success) {
      return { success: false, error: String(fin?.error ?? 'Documento de anulación creado pero no finalizado') };
    }

    // Mark original via note (non-destructive)
    try {
      const prevNote = String(doc.note ?? '').trim();
      const stamp = `ANULADO -> ${reversalDocumentNumber} · ANULADO_ID:${reversalDocumentId}${reason ? ` · Motivo: ${reason}` : ''}`;
      const nextNote = prevNote ? `${prevNote}\n${stamp}` : stamp;

      const nextInternalNote = buildOriginalVoidLinkageInternalNote(doc.internalNote, {
        reversalDocumentId,
        reversalDocumentNumber,
        reason: reason || null,
      });

      await amplifyClient.models.Document.update(
        {
          documentId,
          note: nextNote,
          ...(nextInternalNote ? { internalNote: nextInternalNote } : {}),
        } as any
      );
    } catch {
      // ignore
    }

    writeAuditLog({
      userId: session.userId,
      action: 'VOID',
      tableName: 'Document',
      recordId: documentId,
      newValues: {
        documentId,
        reversalDocumentId,
        reversalDocumentNumber,
        reason: reason || null,
      },
    }).catch(() => {});

    revalidateTag(CACHE_TAGS.heavy.documents);
    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
    revalidateTag(CACHE_TAGS.heavy.stockData);

    return { success: true, reversalDocumentId, reversalDocumentNumber };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
