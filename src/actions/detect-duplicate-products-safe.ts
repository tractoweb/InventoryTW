/**
 * VERSIÓN SEGURA: Detecta duplicados SIN alterar schema de Amplify
 * 
 * Estrategia:
 * - Lee todos los productos (ACTIVOS)
 * - Agrupa por código (EXACT_CODE, 100% confianza)
 * - Agrupa por nombre (EXACT_NAME, 90% confianza)
 * - Retorna candidatos EN MEMORIA (no en BD)
 * - Guarda auditoría en AuditLog
 * 
 * NO crea tabla ProductDuplicateCandidate
 */

import { amplifyClient } from "@/lib/amplify-config";
import { generateClient } from "aws-amplify/api";
import { writeAuditLog } from "@/actions/write-audit-log";
import { requireSession } from "@/actions/require-session";
import { randomUUID } from "crypto";

export interface DuplicateGroup {
  code?: string;
  name?: string;
  confidence: number;
  matchType: "EXACT_CODE" | "EXACT_NAME";
  primaryProductId: number;
  duplicateProductIds: number[];
  productDetails: Array<{
    id: number;
    name: string;
    code: string;
    stock: number;
    documentCount: number;
  }>;
}

export async function detectDuplicateProductsSafe() {
  try {
    const session = await requireSession("ADMIN");

    // Obtener todos los productos ACTIVOS
    const client = generateClient();
    const { data: productsResponse } = await client.graphql({
      query: `query ListProducts {
        listProducts {
          items {
            idProduct
            name
            code
            isEnabled
          }
        }
      }`,
    });

    const products = (productsResponse?.listProducts?.items || []).filter(
      (p: any) => p.isEnabled === true
    );

    // Agrupar por CÓDIGO
    const byCode = new Map<string, any[]>();
    products.forEach((p: any) => {
      if (p.code) {
        if (!byCode.has(p.code)) byCode.set(p.code, []);
        byCode.get(p.code)!.push(p);
      }
    });

    // Agrupar por NOMBRE
    const byName = new Map<string, any[]>();
    products.forEach((p: any) => {
      if (!byName.has(p.name)) byName.set(p.name, []);
      byName.get(p.name)!.push(p);
    });

    // Generar grupos de candidatos
    const groups: DuplicateGroup[] = [];

    // Grupos por EXACT_CODE (100% confianza)
    byCode.forEach((items, code) => {
      if (items.length > 1) {
        groups.push({
          code,
          confidence: 1.0,
          matchType: "EXACT_CODE",
          primaryProductId: items[0].idProduct,
          duplicateProductIds: items.slice(1).map((p: any) => p.idProduct),
          productDetails: items.map((p: any) => ({
            id: p.idProduct,
            name: p.name,
            code: p.code,
            stock: 0, // Se calcularía si fuera necesario
            documentCount: 0,
          })),
        });
      }
    });

    // Grupos por EXACT_NAME (90% confianza) - pero solo si no está en EXACT_CODE
    const codesCovered = new Set(groups.map((g) => g.code));
    byName.forEach((items, name) => {
      if (
        items.length > 1 &&
        !items.every((p: any) => codesCovered.has(p.code))
      ) {
        groups.push({
          name,
          confidence: 0.9,
          matchType: "EXACT_NAME",
          primaryProductId: items[0].idProduct,
          duplicateProductIds: items.slice(1).map((p: any) => p.idProduct),
          productDetails: items.map((p: any) => ({
            id: p.idProduct,
            name: p.name,
            code: p.code,
            stock: 0,
            documentCount: 0,
          })),
        });
      }
    });

    // Guardar en auditoría
    await writeAuditLog({
      action: "DETECT_DUPLICATES",
      entityType: "SYSTEM",
      entityId: 0,
      details: {
        duplicateGroupsFound: groups.length,
        totalDuplicates: groups.reduce((acc, g) => acc + g.duplicateProductIds.length, 0),
        matchTypes: {
          EXACT_CODE: groups.filter((g) => g.matchType === "EXACT_CODE").length,
          EXACT_NAME: groups.filter((g) => g.matchType === "EXACT_NAME").length,
        },
      },
      userId: session.userId,
    });

    return {
      success: true,
      duplicateGroups: groups,
      message: `Detectados ${groups.length} grupos de posibles duplicados en memoria`,
    };
  } catch (error) {
    console.error("Error detecting duplicates:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duplicateGroups: [],
    };
  }
}
