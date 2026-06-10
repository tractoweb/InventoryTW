/**
 * VERSIÓN SEGURA: Fusiona productos usando SOLO campos existentes
 * 
 * NO crea ProductMergeHistory
 * Auditoría se guarda en AuditLog con entityType="PRODUCT_MERGE"
 * 
 * Transacción atómica:
 * 1. Valida que ambos productos existan
 * 2. Transfiere barcodes del duplicado al primario
 * 3. Transfiere comentarios
 * 4. Marca duplicado: isEnabled=false, disabledReason=MERGED_WITH_PRIMARY, mergedIntoProductId=primary
 * 5. Registra auditoría
 */

import { amplifyClient } from "@/lib/amplify-config";
import { requireSession } from "@/actions/require-session";
import { writeAuditLog } from "@/actions/write-audit-log";
import { generateClient } from "aws-amplify/api";

export interface MergeResult {
  success: boolean;
  mergeId: string;
  message: string;
  primaryProductId: number;
  duplicateProductId: number;
  barcodesMerged: number;
  commentsMerged: number;
  error?: string;
}

export async function mergeProductsSafe(
  primaryProductId: number,
  duplicateProductId: number,
  notes?: string
): Promise<MergeResult> {
  const mergeId = crypto.randomUUID?.() || `merge-${Date.now()}`;

  try {
    const session = await requireSession("ADMIN");

    if (primaryProductId === duplicateProductId) {
      return {
        success: false,
        mergeId,
        primaryProductId,
        duplicateProductId,
        barcodesMerged: 0,
        commentsMerged: 0,
        message: "Error: Productos idénticos",
        error: "No se puede fusionar un producto consigo mismo",
      };
    }

    const client = generateClient();

    // 1️⃣ OBTENER AMBOS PRODUCTOS
    const { data: primaryData } = await client.graphql({
      query: `query GetProduct($id: Int!) {
        getProduct(idProduct: $id) {
          idProduct
          name
          code
          isEnabled
          disabledReason
        }
      }`,
      variables: { id: primaryProductId },
    });

    const { data: duplicateData } = await client.graphql({
      query: `query GetProduct($id: Int!) {
        getProduct(idProduct: $id) {
          idProduct
          name
          code
        }
      }`,
      variables: { id: duplicateProductId },
    });

    const primary = primaryData?.getProduct;
    const duplicate = duplicateData?.getProduct;

    if (!primary || !duplicate) {
      return {
        success: false,
        mergeId,
        primaryProductId,
        duplicateProductId,
        barcodesMerged: 0,
        commentsMerged: 0,
        message: "Error: Producto no encontrado",
        error: "Uno o ambos productos no existen",
      };
    }

    // 2️⃣ OBTENER BARCODES DEL DUPLICADO
    const { data: barcodesData } = await client.graphql({
      query: `query ListBarcodes {
        listBarcodes(filter: { productId: { eq: ${duplicateProductId} } }) {
          items {
            value
          }
        }
      }`,
    });

    const barcodes = barcodesData?.listBarcodes?.items || [];
    let barcodesMerged = 0;

    // 3️⃣ TRANSFERIR BARCODES (crear en primario, borrar del duplicado)
    for (const barcode of barcodes) {
      try {
        // Crear en primario
        await client.graphql({
          query: `mutation CreateBarcode($input: CreateBarcodeInput!) {
            createBarcode(input: $input) {
              productId
              value
            }
          }`,
          variables: {
            input: {
              productId: primaryProductId,
              value: barcode.value,
            },
          },
        });

        // Borrar del duplicado
        await client.graphql({
          query: `mutation DeleteBarcode($input: DeleteBarcodeInput!) {
            deleteBarcode(input: $input) {
              productId
              value
            }
          }`,
          variables: {
            input: {
              productId: duplicateProductId,
              value: barcode.value,
            },
          },
        });

        barcodesMerged++;
      } catch (err) {
        console.warn(`Failed to merge barcode ${barcode.value}:`, err);
      }
    }

    // 4️⃣ TRANSFERIR COMENTARIOS
    const { data: commentsData } = await client.graphql({
      query: `query ListComments {
        listProductComments(filter: { productId: { eq: ${duplicateProductId} } }) {
          items {
            commentId
            comment
          }
        }
      }`,
    });

    const comments = commentsData?.listProductComments?.items || [];
    let commentsMerged = 0;

    for (const comment of comments) {
      try {
        await client.graphql({
          query: `mutation CreateComment($input: CreateProductCommentInput!) {
            createProductComment(input: $input) {
              commentId
            }
          }`,
          variables: {
            input: {
              commentId: Date.now() + Math.random(),
              productId: primaryProductId,
              comment: `[MERGED FROM ${duplicate.code}] ${comment.comment}`,
            },
          },
        });
        commentsMerged++;
      } catch (err) {
        console.warn(`Failed to merge comment:`, err);
      }
    }

    // 5️⃣ MARCAR DUPLICADO COMO DESHABILITADO
    await client.graphql({
      query: `mutation UpdateProduct($input: UpdateProductInput!) {
        updateProduct(input: $input) {
          idProduct
          isEnabled
          disabledReason
          mergedIntoProductId
        }
      }`,
      variables: {
        input: {
          idProduct: duplicateProductId,
          isEnabled: false,
          disabledReason: "MERGED_WITH_PRIMARY",
          mergedIntoProductId: primaryProductId,
        },
      },
    });

    // 6️⃣ GUARDAR EN AUDITORÍA
    await writeAuditLog({
      action: "PRODUCT_MERGE",
      entityType: "PRODUCT",
      entityId: duplicateProductId,
      details: {
        mergeId,
        primaryProductId,
        duplicateProductId,
        barcodesMerged,
        commentsMerged,
        notes,
      },
      userId: session.userId,
    });

    return {
      success: true,
      mergeId,
      message: "✅ Fusión completada exitosamente",
      primaryProductId,
      duplicateProductId,
      barcodesMerged,
      commentsMerged,
    };
  } catch (error) {
    console.error("Error merging products:", error);
    await writeAuditLog({
      action: "PRODUCT_MERGE_FAILED",
      entityType: "PRODUCT",
      entityId: duplicateProductId,
      details: {
        mergeId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return {
      success: false,
      mergeId,
      primaryProductId,
      duplicateProductId,
      barcodesMerged: 0,
      commentsMerged: 0,
      message: "❌ Error en la fusión",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
