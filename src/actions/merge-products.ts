"use server";
import "server-only";

import { amplifyClient, formatAmplifyError, ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";
import { randomUUID } from "crypto";

/**
 * Fusiona dos productos:
 * 1. Primario: se mantiene activo
 * 2. Duplicado: se marca como MERGED_WITH_PRIMARY y deshabilitado
 * 
 * Transfieres:
 * - Barcodes del duplicado al primario
 * - Comentarios del duplicado (con prefijo)
 * - StockControls (toma el mejor/más alto)
 * 
 * NO se transfieren:
 * - DocumentItems (podrían romper auditoría)
 * - Kardex (histórico debe preservarse)
 * - Stock (cada uno mantiene su historial)
 */
export async function mergeProducts(
  primaryProductId: number,
  duplicateProductId: number,
  notes?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  mergeId?: string;
  barcodesMerged?: number;
  commentsMerged?: number;
  stockControlsMerged?: number;
}> {
  try {
    const session = await requireSession(ACCESS_LEVELS.ADMIN);

    // Validaciones básicas
    if (!Number.isFinite(primaryProductId) || primaryProductId <= 0) {
      return { success: false, error: "ID de producto primario inválido" };
    }
    if (!Number.isFinite(duplicateProductId) || duplicateProductId <= 0) {
      return { success: false, error: "ID de producto duplicado inválido" };
    }
    if (primaryProductId === duplicateProductId) {
      return { success: false, error: "No puedes fusionar un producto consigo mismo" };
    }

    // Obtener productos
    const primaryRes = await amplifyClient.models.Product.get({
      idProduct: primaryProductId,
    } as any);
    const primary = (primaryRes as any)?.data;

    const duplicateRes = await amplifyClient.models.Product.get({
      idProduct: duplicateProductId,
    } as any);
    const duplicate = (duplicateRes as any)?.data;

    if (!primary || !duplicate) {
      return { success: false, error: "Uno o ambos productos no existen" };
    }

    const mergeId = randomUUID();
    let barcodesMerged = 0;
    let commentsMerged = 0;
    let stockControlsMerged = 0;

    // PASO 1: Transferir barcodes del duplicado al primario
    try {
      const barcodeRes = await amplifyClient.models.Barcode.list({
        filter: { productId: { eq: duplicateProductId } },
      } as any);

      for (const barcode of barcodeRes.data ?? []) {
        try {
          // Eliminar el barcode del duplicado
          await amplifyClient.models.Barcode.delete({
            productId: (barcode as any).productId,
            value: (barcode as any).value,
          } as any);

          // Crear en el primario
          await amplifyClient.models.Barcode.create({
            productId: primaryProductId,
            value: (barcode as any).value,
          } as any);

          barcodesMerged++;
        } catch {
          // Ignorar errores de barcode duplicado
        }
      }
    } catch (e) {
      console.error("Error transferring barcodes:", e);
    }

    // PASO 2: Transferir comentarios del duplicado al primario
    try {
      const commentsRes = await amplifyClient.models.ProductComment.list({
        filter: { productId: { eq: duplicateProductId } },
      } as any);

      for (const comment of commentsRes.data ?? []) {
        try {
          await amplifyClient.models.ProductComment.create({
            commentId: Math.floor(Math.random() * 1000000),
            productId: primaryProductId,
            comment: `[MERGED FROM DUP] ${(comment as any).comment}`,
          } as any);

          commentsMerged++;
        } catch (e) {
          console.error("Error transferring comment:", e);
        }
      }
    } catch (e) {
      console.error("Error fetching comments:", e);
    }

    // PASO 3: Fusionar StockControls
    try {
      const primarySCRes = await amplifyClient.models.StockControl.list({
        filter: { productId: { eq: primaryProductId } },
      } as any);
      const primarySC = primarySCRes.data?.[0] as any;

      const duplicateSCRes = await amplifyClient.models.StockControl.list({
        filter: { productId: { eq: duplicateProductId } },
      } as any);
      const duplicateSC = duplicateSCRes.data?.[0] as any;

      // Si el duplicado tiene StockControl y el primario no, transferir
      if (duplicateSC && !primarySC) {
        try {
          await amplifyClient.models.StockControl.create({
            stockControlId: Math.floor(Math.random() * 1000000),
            productId: primaryProductId,
            reorderPoint: duplicateSC.reorderPoint,
            preferredQuantity: duplicateSC.preferredQuantity,
            isLowStockWarningEnabled: duplicateSC.isLowStockWarningEnabled,
            lowStockWarningQuantity: duplicateSC.lowStockWarningQuantity,
          } as any);

          stockControlsMerged++;
        } catch (e) {
          console.error("Error creating StockControl:", e);
        }
      }
    } catch (e) {
      console.error("Error handling StockControl:", e);
    }

    // PASO 4: Marcar producto duplicado como eliminado (SOFT DELETE)
    try {
      await amplifyClient.models.Product.update({
        idProduct: duplicateProductId,
        isEnabled: false,
        disabledReason: "MERGED_WITH_PRIMARY",
        disabledAt: new Date().toISOString(),
        mergedIntoProductId: primaryProductId,
      } as any);
    } catch (e) {
      return {
        success: false,
        error: `Error deshabilitando producto duplicado: ${formatAmplifyError(e)}`,
      };
    }

    // PASO 5: Crear registro en DisabledEntityHistory
    try {
      await amplifyClient.models.DisabledEntityHistory.create({
        historyId: randomUUID(),
        entityType: "Product",
        entityId: duplicateProductId,
        reason: "MERGED_WITH_PRIMARY",
        disabledBy: session.userId,
        disabledAt: new Date().toISOString(),
        tags: ["merged", "duplicate"],
        notes: `Merged into Product ID ${primaryProductId}. ${notes || ""}`,
      } as any);
    } catch (e) {
      console.error("Error creating DisabledEntityHistory:", e);
    }

    // PASO 6: Crear registro en ProductMergeHistory
    try {
      await amplifyClient.models.ProductMergeHistory.create({
        mergeId,
        primaryProductId,
        duplicateProductId,
        mergedBy: session.userId,
        mergedAt: new Date().toISOString(),
        barcodesMerged,
        commentsMerged,
        stockControlsMerged,
        notes: `Merged "${duplicate.name}" into "${primary.name}". ${notes || ""}`,
        reversible: false,
      } as any);
    } catch (e) {
      console.error("Error creating ProductMergeHistory:", e);
    }

    // PASO 7: Crear registro en ProductDuplicateCandidate
    try {
      const candidateRes = await amplifyClient.models.ProductDuplicateCandidate.list({
        filter: {
          and: [
            { primaryProductId: { eq: primaryProductId } },
            { duplicateProductId: { eq: duplicateProductId } },
          ],
        },
      } as any);

      if (candidateRes.data?.[0]) {
        await amplifyClient.models.ProductDuplicateCandidate.update({
          candidateId: (candidateRes.data[0] as any).candidateId,
          status: "MERGED",
        } as any);
      }
    } catch (e) {
      console.error("Error updating ProductDuplicateCandidate:", e);
    }

    // PASO 8: Auditoría
    await writeAuditLog({
      userId: session.userId,
      action: "PRODUCT_MERGE",
      tableName: "Product",
      recordId: primaryProductId,
      newValues: {
        mergedProductId: duplicateProductId,
        mergeId,
        barcodesMerged,
        commentsMerged,
        stockControlsMerged,
      },
      reason: `Merged duplicate product ${duplicateProductId} into ${primaryProductId}`,
      impactedDocuments: 0,
    }).catch(() => {});

    return {
      success: true,
      message: `Productos fusionados exitosamente. Primario: "${primary.name}", Duplicado: "${duplicate.name}"`,
      mergeId,
      barcodesMerged,
      commentsMerged,
      stockControlsMerged,
    };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
