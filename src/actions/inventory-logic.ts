import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

async function nextCounterValue(counterName: string): Promise<number> {
  const { data: existing } = await client.models.Counter.get({ name: counterName });
  if (!existing) {
    const created = await client.models.Counter.create({ name: counterName, value: 1 });
    return (created.data as any)?.value ?? 1;
  }

  const current = Number((existing as any).value ?? 0);
  const next = (Number.isFinite(current) ? current : 0) + 1;
  await client.models.Counter.update({ name: counterName, value: next });
  return next;
}

/**
 * Registra un movimiento en el Kardex y actualiza el stock actual del producto.
 */
export async function registerInventoryMovement({
  productId,
  warehouseId,
  quantity, // Positivo para entrada, negativo para salida
  type,
  documentId,
  documentNumber,
  userId,
  note
}: {
  productId: number | string;
  warehouseId: number | string;
  quantity: number;
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  documentId?: number | string;
  documentNumber?: string;
  userId?: number | string;
  note?: string;
}) {
  try {
    const normalizedProductId = Number(productId);
    const normalizedWarehouseId = Number(warehouseId);
    const normalizedDocumentId = documentId === undefined ? undefined : Number(documentId);
    const normalizedUserId = userId === undefined ? undefined : Number(userId);

    // 1. Obtener o crear el registro de Stock actual
    const { data: stocks } = await client.models.Stock.list({
      filter: {
        productId: { eq: normalizedProductId },
        warehouseId: { eq: normalizedWarehouseId }
      }
    });

    let currentStock = stocks[0];
    let newQuantity = quantity;

    if (currentStock) {
      newQuantity = currentStock.quantity + quantity;
      await client.models.Stock.update({
        productId: (currentStock as any).productId,
        warehouseId: (currentStock as any).warehouseId,
        quantity: newQuantity
      });
    } else {
      await client.models.Stock.create({
        productId: normalizedProductId,
        warehouseId: normalizedWarehouseId,
        quantity
      });
    }

    // 2. Crear entrada en el Kardex
    const kardexId = await nextCounterValue('kardexId');
    await client.models.Kardex.create({
      kardexId,
      productId: normalizedProductId,
      date: new Date().toISOString(),
      type,
      quantity,
      balance: newQuantity,
      documentId: normalizedDocumentId,
      documentNumber,
      userId: normalizedUserId,
      note
    });

    return { success: true, balance: newQuantity };
  } catch (error) {
    console.error('Error al registrar movimiento de inventario:', error);
    throw error;
  }
}
