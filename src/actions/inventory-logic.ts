import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

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
  productId: string;
  warehouseId: string;
  quantity: number;
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  documentId?: string;
  documentNumber?: string;
  userId?: string;
  note?: string;
}) {
  try {
    // 1. Obtener o crear el registro de Stock actual
    const { data: stocks } = await client.models.Stock.list({
      filter: {
        productId: { eq: productId },
        warehouseId: { eq: warehouseId }
      }
    });

    let currentStock = stocks[0];
    let newQuantity = quantity;

    if (currentStock) {
      newQuantity = currentStock.quantity + quantity;
      await client.models.Stock.update({
        id: currentStock.id,
        quantity: newQuantity
      });
    } else {
      await client.models.Stock.create({
        productId,
        warehouseId,
        quantity: quantity
      });
    }

    // 2. Crear entrada en el Kardex
    await client.models.Kardex.create({
      productId,
      date: new Date().toISOString(),
      type,
      quantity,
      balance: newQuantity,
      documentId,
      documentNumber,
      userId,
      note
    });

    return { success: true, balance: newQuantity };
  } catch (error) {
    console.error('Error al registrar movimiento de inventario:', error);
    throw error;
  }
}
