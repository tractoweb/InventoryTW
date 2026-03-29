import { z } from 'zod';
import { NextRequest } from 'next/server';

import { ACCESS_LEVELS } from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-config';
import { requireSession } from '@/lib/session';
import { getCurrentSession } from '@/lib/session';
import { adjustStock } from '@/actions/adjust-stock';
import { createProductAction } from '@/actions/create-product';
import { deleteProduct } from '@/actions/delete-product';
import { updateDocumentMetadataAction } from '@/actions/update-document-metadata';
import { writeAuditLog } from '@/services/audit-log-service';
const ExecuteSchema = z.object({
  operation: z.enum([
    'adjustStock',
    'createProduct',
    'queryDB',
    'updateProduct',
    'deleteProduct',
    'updateDocumentMetadata',
  ]),
  params: z.record(z.any()).default({}),
  confirmation: z.boolean().default(false),
  doubleConfirmation: z.boolean().default(false),
});

const AdjustStockParams = z.object({
  productId: z.coerce.number().min(1),
  warehouseId: z.coerce.number().min(1),
  quantity: z.coerce.number().min(0),
  reason: z.string().trim().max(280).optional(),
});

const CreateProductParams = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(50).optional(),
  cost: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0).optional(),
  productGroupId: z.coerce.number().min(1).optional(),
});

// ── Nuevas operaciones ────────────────────────────────────────────────────────

const ALLOWED_QUERY_TABLES = [
  'Product', 'Stock', 'Kardex', 'Document', 'DocumentItem',
  'Customer', 'Client', 'Warehouse', 'DocumentType', 'ProductGroup',
  'Tax', 'Payment', 'Barcode', 'ProductTax', 'DocumentItemTax',
] as const;
type AllowedQueryTable = (typeof ALLOWED_QUERY_TABLES)[number];

const QueryDBParams = z.object({
  table: z.enum(ALLOWED_QUERY_TABLES),
  columns: z.array(z.string().trim().max(50)).max(15).optional(),
  nameContains: z.string().trim().max(120).optional(),
  codeContains: z.string().trim().max(80).optional(),
  productId: z.coerce.number().optional(),
  warehouseId: z.coerce.number().optional(),
  documentId: z.coerce.number().optional(),
  customerId: z.coerce.number().optional(),
  clientId: z.coerce.number().optional(),
  documentTypeId: z.coerce.number().optional(),
  productGroupId: z.coerce.number().optional(),
  taxId: z.coerce.number().optional(),
  isEnabled: z.boolean().optional(),
  type: z.string().trim().max(40).optional(),
  dateFrom: z.string().trim().max(20).optional(),
  dateTo: z.string().trim().max(20).optional(),
  nextToken: z.string().trim().max(400).optional(),
  all: z.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const UpdateProductParams = z.object({
  productId: z.coerce.number().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  code: z.string().trim().max(50).optional(),
  price: z.coerce.number().min(0).optional(),
  cost: z.coerce.number().min(0).optional(),
  description: z.string().trim().max(500).optional(),
  productGroupId: z.coerce.number().min(1).optional(),
});

const DeleteProductParams = z.object({
  productId: z.coerce.number().min(1),
});

const UpdateDocumentMetadataParams = z.object({
  documentId: z.coerce.number().min(1),
  note: z.string().trim().max(500).optional(),
  clientName: z.string().trim().max(120).optional(),
  clientId: z.coerce.number().optional(),
  customerId: z.coerce.number().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isWriteActionsEnabled(): boolean {
  const raw = process.env.AI_ENABLE_WRITE_ACTIONS;
  const v = String(raw ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function wantsAllRows(input: { all?: boolean; nameContains?: string; codeContains?: string }): boolean {
  if (input.all) return true;
  const name = String(input.nameContains ?? '').trim().toLowerCase();
  const code = String(input.codeContains ?? '').trim().toLowerCase();
  return name === '*' || name === 'all' || code === '*' || code === 'all';
}

async function writeAiActionAudit(input: {
  tableName: string;
  recordId: number;
  action: string;
  oldValues?: unknown;
  newValues?: unknown;
}): Promise<void> {
  try {
    const sessionRes = await getCurrentSession();
    const userId = Number(sessionRes?.data?.userId ?? 0);
    if (!Number.isFinite(userId) || userId <= 0) return;

    await writeAuditLog({
      userId,
      action: input.action,
      tableName: input.tableName,
      recordId: input.recordId,
      oldValues: input.oldValues,
      newValues: {
        source: 'AI_ASSISTANT',
        updatedVia: 'IA',
        updatedAt: new Date().toISOString(),
        ...(typeof input.newValues === 'object' && input.newValues ? (input.newValues as Record<string, unknown>) : {}),
      },
    });
  } catch {
    // best-effort only
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = ExecuteSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError('Solicitud de acción inválida', 400);
    }

    const { operation, params, confirmation, doubleConfirmation } = parsed.data;

    // ── queryDB: solo lectura — no bloquear por AI_ENABLE_WRITE_ACTIONS ─────
    if (operation === 'queryDB') {
      await requireSession(ACCESS_LEVELS.CASHIER);

      const validated = QueryDBParams.safeParse(params);
      if (!validated.success) {
        return jsonError('Parámetros inválidos para queryDB: ' + validated.error.issues.map((i) => i.message).join(', '), 400);
      }

            const { table, limit, productId, warehouseId, documentId, customerId, clientId,
              documentTypeId, productGroupId, taxId, isEnabled, type, dateFrom, dateTo,
              columns, nameContains, codeContains, nextToken, all } = validated.data;

      const clauses: any[] = [];
      if (productId)       clauses.push({ productId:       { eq: productId } });
      if (warehouseId)     clauses.push({ warehouseId:     { eq: warehouseId } });
      if (documentId)      clauses.push({ documentId:      { eq: documentId } });
      if (customerId)      clauses.push({ customerId:      { eq: customerId } });
      if (clientId)        clauses.push({ clientId:        { eq: clientId } });
      if (documentTypeId)  clauses.push({ documentTypeId:  { eq: documentTypeId } });
      if (productGroupId)  clauses.push({ productGroupId:  { eq: productGroupId } });
      if (taxId)           clauses.push({ taxId:           { eq: taxId } });
      if (isEnabled !== undefined) clauses.push({ isEnabled: { eq: isEnabled } });
      if (type)            clauses.push({ type:            { eq: type } });
      if (dateFrom && dateTo)  clauses.push({ date: { between: [dateFrom, dateTo] } });
      else if (dateFrom)       clauses.push({ date: { ge: dateFrom } });
      else if (dateTo)         clauses.push({ date: { le: dateTo } });
  if (nameContains) clauses.push({ name: { contains: nameContains } });
  if (codeContains) clauses.push({ code: { contains: codeContains } });

      const filter = clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : { and: clauses };
      const model = (amplifyClient.models as any)[table as string];
      if (!model) return jsonError(`Tabla no disponible: ${table}`, 400);

      const includeAll = wantsAllRows({ all, nameContains, codeContains });
      const rows: any[] = [];
      let pageToken: string | null | undefined = nextToken ?? undefined;

      if (includeAll) {
        const perPage = 200;
        const maxRows = 5000;
        const maxPages = 50;
        let pages = 0;

        do {
          const res: any = await model.list({ ...(filter ? { filter } : {}), limit: perPage, nextToken: pageToken } as any);
          rows.push(...((res?.data ?? []) as any[]));
          pageToken = res?.nextToken;
          pages++;
          if (rows.length >= maxRows) break;
          if (pages >= maxPages) break;
        } while (pageToken);
      } else {
        const res: any = await model.list({ ...(filter ? { filter } : {}), limit, nextToken: pageToken } as any);
        rows.push(...((res?.data ?? []) as any[]));
        pageToken = res?.nextToken;
      }

      if (rows.length === 0) {
        return new Response(
          JSON.stringify({
            success: true, operation,
            message: `✅ Consulta ejecutada en ${table}. No se encontraron registros con los filtros indicados.`,
            result: { table, count: 0, nextToken: null, allLoaded: true },
            table: { title: `Resultados: ${table}`, columns: ['mensaje'], rows: [['Sin resultados']] },
            links: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const EXCLUDE_KEYS = new Set(['__typename', 'createdAt', 'updatedAt', 'nextToken']);
      const EXCLUDE_RELATIONS = new Set([
        'productGroup', 'barcodes', 'stocks', 'stockControls', 'documentItems',
        'comments', 'taxes', 'kardexEntries', 'kardexHistories', 'warehouse',
        'product', 'document', 'customer', 'client', 'documentType', 'user',
        'paymentType', 'tax', 'documentCategory', 'children', 'payments', 'auditLogs',
      ]);
      const isGarbage = (v: unknown) =>
        typeof v === 'function' ||
        (typeof v === 'string' && v.length > 20 && (v.startsWith('n=>') || v.startsWith('e=>') || v.includes('=>t[')));
      let allColumns = Object.keys(rows[0]).filter((k) =>
        !EXCLUDE_KEYS.has(k) && !k.startsWith('_') && !EXCLUDE_RELATIONS.has(k) && !isGarbage(rows[0][k])
      );
      if (columns?.length) {
        const avail = new Set(allColumns);
        const proj = columns.filter((c) => avail.has(c));
        if (proj.length > 0) allColumns = proj;
      }
      const tableRows = rows.map((row: any) =>
        allColumns.map((col) => {
          const v = row[col];
          if (v === null || v === undefined) return '-';
          if (isGarbage(v)) return '-';
          if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
          return String(v);
        })
      );

      return new Response(
        JSON.stringify({
          success: true, operation,
          message: includeAll
            ? `✅ Consulta en ${table}: ${rows.length} registro(s) cargados (modo all/*).`
            : `✅ Consulta en ${table}: ${rows.length} registro(s) encontrado(s).${pageToken ? ' Hay más resultados disponibles con nextToken.' : ''}`,
          result: { table, count: rows.length, nextToken: pageToken ?? null, allLoaded: includeAll && !pageToken },
          table: { title: `Resultados: ${table} (${rows.length} filas)`, columns, rows: tableRows },
          links: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Operaciones de escritura: requieren AI_ENABLE_WRITE_ACTIONS ──────────
    if (!isWriteActionsEnabled()) {
      return jsonError('Las acciones de escritura IA están deshabilitadas por configuración (AI_ENABLE_WRITE_ACTIONS).', 403);
    }

    if (!confirmation) {
      return jsonError('La acción requiere confirmación explícita del usuario', 400);
    }

    if (operation === 'adjustStock') {
      await requireSession(ACCESS_LEVELS.CASHIER);

      const validated = AdjustStockParams.safeParse(params);
      if (!validated.success) {
        return jsonError('Parámetros inválidos para ajuste de stock', 400);
      }

      const res = await adjustStock({
        productId: validated.data.productId,
        warehouseId: validated.data.warehouseId,
        quantity: validated.data.quantity,
        reason: validated.data.reason,
      });

      if (!res.success) {
        return jsonError(String(res.error ?? 'No se pudo ajustar el stock'), 400);
      }

      const productRes = await amplifyClient.models.Product.get({ idProduct: validated.data.productId } as any);
      const product: any = productRes?.data;
      const productLabel = String(product?.code ?? product?.name ?? validated.data.productId);

      void writeAiActionAudit({
        tableName: 'Product',
        recordId: Number(validated.data.productId),
        action: 'AI_STOCK_ADJUST',
        newValues: {
          warehouseId: validated.data.warehouseId,
          previousQuantity: res.previousQuantity,
          newQuantity: res.newQuantity,
          difference: res.difference,
          reason: validated.data.reason ?? 'Ajuste IA',
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          operation,
          message: `✅ Ajuste aplicado: stock actualizado para ${productLabel}. Antes: ${res.previousQuantity}, ahora: ${res.newQuantity} (Δ ${res.difference}).`,
          result: {
            previousQuantity: res.previousQuantity,
            newQuantity: res.newQuantity,
            difference: res.difference,
            productId: validated.data.productId,
            warehouseId: validated.data.warehouseId,
          },
          links: [
            {
              label: 'Ver producto en Inventario',
              url: `/inventory?q=${encodeURIComponent(productLabel)}`,
            },
            {
              label: 'Ver stock del producto',
              url: `/stock?q=${encodeURIComponent(productLabel)}`,
            },
            {
              label: 'Abrir Kardex',
              url: '/kardex',
            },
          ],
          table: {
            title: 'Resultado de ajuste de stock',
            columns: ['Producto', 'Almacén', 'Stock anterior', 'Stock nuevo', 'Diferencia'],
            rows: [[productLabel, validated.data.warehouseId, res.previousQuantity, res.newQuantity, res.difference]],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (operation === 'createProduct') {
      await requireSession(ACCESS_LEVELS.ADMIN);

      const validated = CreateProductParams.safeParse(params);
      if (!validated.success) {
        return jsonError('Parámetros inválidos para creación de producto', 400);
      }

      // Keep strict safety for write actions from AI.
      if (!doubleConfirmation) {
        return jsonError('Crear producto requiere doble confirmación', 400);
      }

      const res = await createProductAction({
        name: validated.data.name,
        code: validated.data.code,
        cost: validated.data.cost,
        price: validated.data.price,
        productGroupId: validated.data.productGroupId,
      });

      if (!res.success || !res.idProduct) {
        return jsonError(String(res.error ?? 'No se pudo crear el producto'), 400);
      }

      return new Response(
        JSON.stringify({
          success: true,
          operation,
          message: `✅ Producto creado con éxito. ID ${res.idProduct}.`,
          result: {
            idProduct: res.idProduct,
            name: validated.data.name,
            code: validated.data.code ?? null,
          },
          links: [
            {
              label: 'Abrir producto en Inventario',
              url: `/inventory?q=${encodeURIComponent(String(validated.data.code ?? validated.data.name))}`,
            },
            {
              label: 'Revisar stock del producto',
              url: `/stock?q=${encodeURIComponent(String(validated.data.code ?? validated.data.name))}`,
            },
          ],
          table: {
            title: 'Producto creado',
            columns: ['ID', 'Código', 'Nombre'],
            rows: [[res.idProduct, validated.data.code ?? '-', validated.data.name]],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── updateProduct: edición de campos básicos de un producto ─────────────
    if (operation === 'updateProduct') {
      await requireSession(ACCESS_LEVELS.ADMIN);
      const validated = UpdateProductParams.safeParse(params);
      if (!validated.success) {
        return jsonError('Parámetros inválidos para updateProduct', 400);
      }

      const { productId, name, code, price, cost, description, productGroupId } = validated.data;

      const existing: any = await amplifyClient.models.Product.get({ idProduct: productId } as any);
      const product: any = existing?.data;
      if (!product) return jsonError(`Producto ${productId} no encontrado`, 404);

      const patch: any = { idProduct: productId };
      const changed: string[] = [];
      if (name !== undefined)           { patch.name = name;                         changed.push(`nombre: "${name}"`); }
      if (code !== undefined)           { patch.code = code;                         changed.push(`código: "${code}"`); }
      if (price !== undefined)          { patch.price = price;                       changed.push(`precio: ${price}`); }
      if (cost !== undefined)           { patch.cost = cost;                         changed.push(`costo: ${cost}`); }
      if (description !== undefined)    { patch.description = description;           changed.push(`descripción actualizada`); }
      if (productGroupId !== undefined) { patch.productGroupId = productGroupId;     changed.push(`grupo: ${productGroupId}`); }

      if (changed.length === 0) return jsonError('No se especificaron campos a actualizar', 400);

      const updated: any = await amplifyClient.models.Product.update(patch as any);
      if (!updated?.data) return jsonError('No se pudo actualizar el producto', 500);

      void writeAiActionAudit({
        tableName: 'Product',
        recordId: Number(productId),
        action: 'AI_UPDATE',
        oldValues: {
          name: product?.name,
          code: product?.code,
          price: product?.price,
          cost: product?.cost,
          description: product?.description,
          productGroupId: product?.productGroupId,
        },
        newValues: {
          changed,
          patch: Object.fromEntries(Object.entries(patch).filter(([k]) => k !== 'idProduct')),
        },
      });

      const productLabel = String(updated.data.code ?? updated.data.name ?? productId);
      return new Response(
        JSON.stringify({
          success: true,
          operation,
          message: `✅ Producto actualizado: ${productLabel}. Cambios: ${changed.join(', ')}.`,
          result: { productId, changes: changed },
          links: [
            { label: 'Ver en Inventario', url: `/inventory?q=${encodeURIComponent(productLabel)}` },
          ],
          table: {
            title: 'Campo(s) modificado(s)',
            columns: ['Campo', 'Nuevo valor'],
            rows: Object.entries(patch)
              .filter(([k]) => k !== 'idProduct')
              .map(([k, v]) => [k, String(v)]),
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── deleteProduct: desactivación (soft-delete) ───────────────────────────
    if (operation === 'deleteProduct') {
      await requireSession(ACCESS_LEVELS.ADMIN);
      if (!doubleConfirmation) return jsonError('Desactivar un producto requiere doble confirmación', 400);

      const validated = DeleteProductParams.safeParse(params);
      if (!validated.success) return jsonError('Parámetros inválidos para deleteProduct', 400);

      const res = await deleteProduct(validated.data.productId);
      if (!res.success) return jsonError(String(res.error ?? 'No se pudo desactivar el producto'), 400);

      return new Response(
        JSON.stringify({
          success: true,
          operation,
          message: `✅ Producto ID ${validated.data.productId} desactivado. Permanece en la base de datos para trazabilidad pero no aparecerá en listados.`,
          result: { productId: validated.data.productId },
          links: [{ label: 'Ver productos desactivados', url: '/inventory?tab=deleted' }],
          table: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── updateDocumentMetadata: nota, cliente, proveedor de un documento ─────
    if (operation === 'updateDocumentMetadata') {
      const validated = UpdateDocumentMetadataParams.safeParse(params);
      if (!validated.success) return jsonError('Parámetros inválidos para updateDocumentMetadata', 400);

      const res = await updateDocumentMetadataAction(validated.data);
      if (!res.success) return jsonError(String(res.error ?? 'No se pudo actualizar el documento'), 400);

      const changed: string[] = [];
      if (validated.data.note !== undefined)       changed.push('nota');
      if (validated.data.clientName !== undefined) changed.push('nombre de cliente');
      if (validated.data.clientId !== undefined)   changed.push('cliente vinculado');
      if (validated.data.customerId !== undefined) changed.push('proveedor vinculado');

      void writeAiActionAudit({
        tableName: 'Document',
        recordId: Number(validated.data.documentId),
        action: 'AI_UPDATE',
        newValues: {
          changed,
          note: validated.data.note,
          clientName: validated.data.clientName,
          clientId: validated.data.clientId,
          customerId: validated.data.customerId,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          operation,
          message: `✅ Documento ${validated.data.documentId} actualizado. Campos modificados: ${changed.join(', ')}.`,
          result: { documentId: validated.data.documentId, changes: changed },
          links: [
            { label: `Ver documento ${validated.data.documentId}`, url: `/documents/${validated.data.documentId}/pdf` },
          ],
          table: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return jsonError('Operación no soportada', 400);
  } catch (error: any) {
    const msg = String(error?.message ?? 'Error interno');
    const unauthorized = /No autenticado|No autorizado/i.test(msg);
    return jsonError(msg, unauthorized ? 403 : 500);
  }
}
