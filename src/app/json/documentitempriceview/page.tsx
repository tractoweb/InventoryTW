"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listDocumentItemPriceViews, createDocumentItemPriceView } from "@/services/document-item-price-view-service";
import documentItemPriceViewData from "@/lib/data/DocumentItemPriceView.json";

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
      const existingKeys = new Set(existing.map((d: any) => `${d.documentItemId}|${d.price}`));
      function toAmplifyDocumentItemPriceView(row: any) {
        return {
          documentItemId: row.documentItemId ?? row.DocumentItemId,
          price: row.price ?? row.Price,
          // ...otros campos según modelo Amplify
        };
      }
      for (const row of (documentItemPriceViewData ?? []) as any[]) {
        const documentItemId = row.documentItemId ?? row.DocumentItemId;
        const price = row.price ?? row.Price;
        const key = `${documentItemId}|${price}`;
        try {
          if (existingKeys.has(key)) {
            results.push({ documentItemId, price, status: "existente", message: "Ya existe en la base" });
          } else {
            await createDocumentItemPriceView(toAmplifyDocumentItemPriceView(row));
            results.push({ documentItemId, price, status: "nuevo" });
            existingKeys.add(key);
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
