import { z } from 'zod';
import { NextRequest } from 'next/server';

import { ACCESS_LEVELS } from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-config';
import { requireSession } from '@/lib/session';
import { adjustStock } from '@/actions/adjust-stock';
import { createProductAction } from '@/actions/create-product';

const ExecuteSchema = z.object({
  operation: z.enum(['adjustStock', 'createProduct']),
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

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = ExecuteSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError('Solicitud de acción inválida', 400);
    }

    const { operation, params, confirmation, doubleConfirmation } = parsed.data;

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

    return jsonError('Operación no soportada', 400);
  } catch (error: any) {
    const msg = String(error?.message ?? 'Error interno');
    const unauthorized = /No autenticado|No autorizado/i.test(msg);
    return jsonError(msg, unauthorized ? 403 : 500);
  }
}
