/**
 * VERSIÓN SEGURA: Deshabilita producto usando SOLO campos existentes
 * 
 * Campos utilizados (todos YA EXISTEN en Product):
 * - isEnabled
 * - disabledReason
 * - disabledAt
 * - lastEnabledAt
 * 
 * NO crea DisabledEntityHistory
 * Auditoría: AuditLog con entityType="PRODUCT_DISABLE"
 */

import { amplifyClient } from "@/lib/amplify-config";
import { requireSession } from "@/actions/require-session";
import { writeAuditLog } from "@/actions/write-audit-log";
import { generateClient } from "aws-amplify/api";

export interface DeleteProductResult {
  success: boolean;
  productId: number;
  message: string;
  error?: string;
}

export type DisabledReason =
  | "Accidental"
  | "Duplicate"
  | "Obsolete"
  | "Temporary"
  | "MERGED_WITH_PRIMARY"
  | "MANUAL_DISABLE"
  | "OTHER";

export async function deleteProduct(
  productId: number,
  reason: DisabledReason = "OTHER",
  details?: string
): Promise<DeleteProductResult> {
  try {
    const session = await requireSession("ADMIN");

    const client = generateClient();

    // Obtener producto actual
    const { data: productData } = await client.graphql({
      query: `query GetProduct($id: Int!) {
        getProduct(idProduct: $id) {
          idProduct
          name
          code
          isEnabled
          lastEnabledAt
        }
      }`,
      variables: { id: productId },
    });

    const product = productData?.getProduct;

    if (!product) {
      return {
        success: false,
        productId,
        message: "Producto no encontrado",
        error: "El producto no existe en la base de datos",
      };
    }

    // Marcar como deshabilitado
    const now = new Date().toISOString();

    const { data: updateData } = await client.graphql({
      query: `mutation UpdateProduct($input: UpdateProductInput!) {
        updateProduct(input: $input) {
          idProduct
          name
          isEnabled
          disabledReason
          disabledAt
          lastEnabledAt
        }
      }`,
      variables: {
        input: {
          idProduct: productId,
          isEnabled: false,
          disabledReason: reason,
          disabledAt: now,
          lastEnabledAt: product.lastEnabledAt || now,
        },
      },
    });

    const updatedProduct = updateData?.updateProduct;

    if (!updatedProduct) {
      throw new Error("No se pudo actualizar el producto");
    }

    // Registrar en auditoría
    await writeAuditLog({
      action: "PRODUCT_DISABLE",
      entityType: "PRODUCT",
      entityId: productId,
      oldValue: `isEnabled: true, reason: N/A`,
      newValue: `isEnabled: false, reason: ${reason}`,
      details: {
        productName: product.name,
        productCode: product.code,
        disabledReason: reason,
        disabledAt: now,
        notes: details,
      },
      userId: session.userId,
    });

    return {
      success: true,
      productId,
      message: `✅ Producto ${product.name} deshabilitado correctamente con razón: ${reason}`,
    };
  } catch (error) {
    console.error("Error disabling product:", error);

    // Registrar el error en auditoría
    try {
      await writeAuditLog({
        action: "PRODUCT_DISABLE_FAILED",
        entityType: "PRODUCT",
        entityId: productId,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } catch (auditError) {
      console.error("Failed to write audit log:", auditError);
    }

    return {
      success: false,
      productId,
      message: "Error al deshabilitar producto",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
