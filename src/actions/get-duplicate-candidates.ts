"use server";
import "server-only";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";

export type DuplicateCandidate = {
  candidateId: string;
  primaryProductId: number;
  primaryProductName: string;
  primaryProductCode: string | null;
  primaryStock: number;
  primaryDocumentCount: number;
  duplicateProductId: number;
  duplicateProductName: string;
  duplicateProductCode: string | null;
  duplicateStock: number;
  duplicateDocumentCount: number;
  matchType: string;
  confidence: number;
  status: string;
  reason: string | null;
  detectedAt: string;
  notes: string | null;
};

/**
 * Obtiene candidatos a duplicados con todas sus propiedades.
 */
export async function getDuplicateCandidates(
  status?: string
): Promise<{
  data: DuplicateCandidate[];
  total: number;
  error?: string;
}> {
  try {
    // Obtener candidatos
    const filterObj = status ? { status: { eq: status } } : undefined;
    const candidatesRes = await amplifyClient.models.ProductDuplicateCandidate.list(
      filterObj ? { filter: filterObj } : {}
    );

    const candidates = candidatesRes.data ?? [];
    const results: DuplicateCandidate[] = [];

    for (const cand of candidates as any[]) {
      // Obtener datos de ambos productos
      const primaryRes = await amplifyClient.models.Product.get({
        idProduct: cand.primaryProductId,
      } as any);
      const duplicateRes = await amplifyClient.models.Product.get({
        idProduct: cand.duplicateProductId,
      } as any);

      const primary = (primaryRes as any)?.data;
      const duplicate = (duplicateRes as any)?.data;

      if (!primary || !duplicate) continue;

      // Contar stock y documentos
      const primaryStockRes = await amplifyClient.models.Stock.list({
        filter: { productId: { eq: cand.primaryProductId } },
      } as any);
      const primaryStock =
        (primaryStockRes.data ?? []).reduce((sum: number, s: any) => sum + (s.quantity ?? 0), 0) || 0;

      const duplicateStockRes = await amplifyClient.models.Stock.list({
        filter: { productId: { eq: cand.duplicateProductId } },
      } as any);
      const duplicateStock =
        (duplicateStockRes.data ?? []).reduce((sum: number, s: any) => sum + (s.quantity ?? 0), 0) || 0;

      const primaryDocRes = await amplifyClient.models.DocumentItem.list({
        filter: { productId: { eq: cand.primaryProductId } },
      } as any);
      const primaryDocCount = primaryDocRes.data?.length ?? 0;

      const duplicateDocRes = await amplifyClient.models.DocumentItem.list({
        filter: { productId: { eq: cand.duplicateProductId } },
      } as any);
      const duplicateDocCount = duplicateDocRes.data?.length ?? 0;

      results.push({
        candidateId: cand.candidateId,
        primaryProductId: primary.idProduct,
        primaryProductName: primary.name,
        primaryProductCode: primary.code,
        primaryStock,
        primaryDocumentCount: primaryDocCount,
        duplicateProductId: duplicate.idProduct,
        duplicateProductName: duplicate.name,
        duplicateProductCode: duplicate.code,
        duplicateStock,
        duplicateDocumentCount: duplicateDocCount,
        matchType: cand.matchType,
        confidence: cand.confidence,
        status: cand.status,
        reason: cand.reason,
        detectedAt: cand.detectedAt,
        notes: cand.notes,
      });
    }

    return { data: results, total: results.length };
  } catch (error) {
    return { data: [], total: 0, error: formatAmplifyError(error) };
  }
}

/**
 * Cambia el estado de un candidato a duplicado.
 */
export async function updateDuplicateCandidateStatus(
  candidateId: string,
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "MERGED"
): Promise<{ success: boolean; error?: string }> {
  try {
    await amplifyClient.models.ProductDuplicateCandidate.update({
      candidateId,
      status,
    } as any);

    return { success: true };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
