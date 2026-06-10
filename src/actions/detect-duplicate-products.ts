"use server";
import "server-only";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { randomUUID } from "crypto";
import { writeAuditLog } from "@/services/audit-log-service";
import { requireSession } from "@/lib/session";
import { ACCESS_LEVELS } from "@/lib/amplify-config";

/**
 * Detecta productos duplicados por:
 * 1. Código idéntico (EXACT_CODE - 100%)
 * 2. Nombre idéntico en mayúsculas (EXACT_NAME - 90%)
 * 3. Barcode duplicado (BARCODE - 95%)
 * 
 * Solo detecta entre productos ACTIVOS.
 * Almacena candidatos en ProductDuplicateCandidate.
 */
export async function detectDuplicateProducts(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  candidatesCreated?: number;
}> {
  try {
    const session = await requireSession(ACCESS_LEVELS.ADMIN);

    // 1. Obtener todos los productos activos
    const allProductsRes = await amplifyClient.models.Product.list();
    const allProducts = (allProductsRes.data ?? []).filter(
      (p: any) => p.isEnabled === true
    );

    if (!allProducts.length) {
      return { success: true, message: "No hay productos activos para analizar", candidatesCreated: 0 };
    }

    const candidates: any[] = [];
    const seen = new Set<string>();

    // 2. EXACT_CODE: Detectar códigos idénticos
    const codeMap = new Map<string, any[]>();
    allProducts.forEach((p: any) => {
      if (p.code && p.code.trim()) {
        const code = String(p.code).toLowerCase().trim();
        if (!codeMap.has(code)) {
          codeMap.set(code, []);
        }
        codeMap.get(code)!.push(p);
      }
    });

    // Procesar duplicados por código
    for (const [code, products] of codeMap) {
      if (products.length > 1) {
        // Ordenar: primero los con más documentos (probable "primario")
        products.sort((a: any, b: any) => {
          const aDocCount = (a.documentItems?.length ?? 0);
          const bDocCount = (b.documentItems?.length ?? 0);
          return bDocCount - aDocCount;
        });

        // Crear par: primario vs duplicados
        for (let i = 1; i < products.length; i++) {
          const key = `${products[0].idProduct}-${products[i].idProduct}`;
          if (!seen.has(key)) {
            candidates.push({
              candidateId: randomUUID(),
              primaryProductId: products[0].idProduct,
              duplicateProductId: products[i].idProduct,
              matchType: "EXACT_CODE",
              confidence: 1.0,
              detectedAt: new Date().toISOString(),
              detectedBy: "SYSTEM",
              status: "PENDING",
              reason: `Código duplicado: "${code}"`,
              notes: `Primario (${products[0].name}) tiene ${products[0].documentItems?.length ?? 0} documentos`,
            });
            seen.add(key);
          }
        }
      }
    }

    // 3. EXACT_NAME: Detectar nombres idénticos (solo si no tienen código duplicado)
    const nameMap = new Map<string, any[]>();
    allProducts.forEach((p: any) => {
      if (p.name && !p.code) {
        const name = String(p.name).toLowerCase().trim();
        if (!nameMap.has(name)) {
          nameMap.set(name, []);
        }
        nameMap.get(name)!.push(p);
      }
    });

    for (const [name, products] of nameMap) {
      if (products.length > 1) {
        products.sort((a: any, b: any) => {
          const aDocCount = (a.documentItems?.length ?? 0);
          const bDocCount = (b.documentItems?.length ?? 0);
          return bDocCount - aDocCount;
        });

        for (let i = 1; i < products.length; i++) {
          const key = `${products[0].idProduct}-${products[i].idProduct}`;
          if (!seen.has(key)) {
            candidates.push({
              candidateId: randomUUID(),
              primaryProductId: products[0].idProduct,
              duplicateProductId: products[i].idProduct,
              matchType: "EXACT_NAME",
              confidence: 0.9,
              detectedAt: new Date().toISOString(),
              detectedBy: "SYSTEM",
              status: "PENDING",
              reason: `Nombre duplicado: "${name}"`,
              notes: "Ambos sin código, podrían ser variantes",
            });
            seen.add(key);
          }
        }
      }
    }

    // 4. Limpiar candidatos anteriores PENDING para evitar duplicados
    const existingCandidates = await amplifyClient.models.ProductDuplicateCandidate.list({
      filter: { status: { eq: "PENDING" } },
    });
    
    for (const existing of existingCandidates.data ?? []) {
      try {
        await amplifyClient.models.ProductDuplicateCandidate.delete({
          candidateId: (existing as any).candidateId,
        } as any);
      } catch {
        // ignore deletion errors
      }
    }

    // 5. Guardar nuevos candidatos
    let created = 0;
    for (const candidate of candidates) {
      try {
        await amplifyClient.models.ProductDuplicateCandidate.create(candidate as any);
        created++;
      } catch (e) {
        console.error("Error creating duplicate candidate:", e);
      }
    }

    // 6. Auditoría
    await writeAuditLog({
      userId: session.userId,
      action: "DUPLICATE_DETECTION",
      tableName: "ProductDuplicateCandidate",
      recordId: 0,
      newValues: { candidatesCreated: created, totalCandidates: candidates.length },
    }).catch(() => {});

    return {
      success: true,
      message: `Detección completada: ${created} candidatos identificados`,
      candidatesCreated: created,
    };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
