"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listDocumentItemPriceViews, createDocumentItemPriceView } from "@/services/document-item-price-view-service";
import { listDocumentItems } from "@/services/document-item-service";
import documentItemPriceViewData from "@/lib/data/DocumentItemPriceView.json";
import documentItemData from "@/lib/data/DocumentItem.json";

interface UploadLog {
  documentItemId: number;
  price: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadDocumentItemPriceView() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listDocumentItemPriceViews()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((d: any) => Number(d.documentItemId)));

      const itemsResult = (await listDocumentItems()) ?? { data: [] };
      const items = Array.isArray(itemsResult) ? itemsResult : itemsResult.data ?? [];
      const documentIdByItemId = new Map<number, number>();
      for (const item of items as any[]) {
        const documentItemId = Number(item.documentItemId);
        const documentId = Number(item.documentId);
        if (documentItemId && documentId) documentIdByItemId.set(documentItemId, documentId);
      }

      if (Array.isArray(documentItemData)) {
        for (const row of documentItemData as any[]) {
          const documentItemId = Number(row.documentItemId ?? row.DocumentItemId ?? row.Id);
          const documentId = Number(row.documentId ?? row.DocumentId);
          if (documentItemId && documentId && !documentIdByItemId.has(documentItemId)) {
            documentIdByItemId.set(documentItemId, documentId);
          }
        }
      }

      const seenInJson = new Set<number>();

      for (const row of (documentItemPriceViewData ?? []) as any[]) {
        const documentItemId = Number(row.documentItemId ?? row.DocumentItemId);
        const price = Number(row.price ?? row.Price);
        try {
          if (!documentItemId || !Number.isFinite(price)) {
            results.push({
              documentItemId: documentItemId || -1,
              price: price || -1,
              status: "error",
              message: "documentItemId y price son obligatorios",
            });
            continue;
          }

          if (seenInJson.has(documentItemId)) {
            results.push({
              documentItemId,
              price,
              status: "existente",
              message: "Duplicado en DocumentItemPriceView.json (mismo documentItemId)",
            });
            continue;
          }
          seenInJson.add(documentItemId);

          if (existingIds.has(documentItemId)) {
            results.push({ documentItemId, price, status: "existente", message: "Ya existe en la base" });
          } else {
            const documentId = documentIdByItemId.get(documentItemId);
            if (!documentId) {
              results.push({
                documentItemId,
                price,
                status: "error",
                message: "No se pudo resolver documentId para este documentItemId. Importa primero DocumentItem.",
              });
              continue;
            }

            await createDocumentItemPriceView({ documentItemId, price, documentId });
            results.push({ documentItemId, price, status: "nuevo" });
            existingIds.add(documentItemId);
          }
        } catch (e: any) {
          results.push({ documentItemId, price, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ documentItemId: -1, price: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Precios de Item Documento desde DocumentItemPriceView.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID Item</th>
                <th className="px-2 py-1 border">Precio</th>
                <th className="px-2 py-1 border">Estado</th>
                <th className="px-2 py-1 border">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-gray-500 py-2">No se han subido registros.</td></tr>
              ) : (
                log.map((item, i) => (
                  <tr key={i} className={
                    item.status === "nuevo" ? "text-green-600" :
                    item.status === "existente" ? "text-gray-500" :
                    "text-red-600"
                  }>
                    <td className="border px-2 py-1">{item.documentItemId ?? "-"}</td>
                    <td className="border px-2 py-1">{item.price ?? "-"}</td>
                    <td className="border px-2 py-1">{item.status}</td>
                    <td className="border px-2 py-1">{item.message ?? ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
