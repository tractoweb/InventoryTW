"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listDocumentItems, createDocumentItem } from "@/services/document-item-service";
import documentItemData from "@/lib/data/DocumentItem.json";

interface UploadLog {
  documentItemId: number;
  documentId: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadDocumentItem() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listDocumentItems()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((d: any) => d.documentItemId));
      function toAmplifyDocumentItem(row: any) {
        return {
          documentItemId: row.documentItemId ?? row.DocumentItemId ?? row.Id,
          documentId: row.documentId ?? row.DocumentId,
          // ...otros campos según modelo Amplify
        };
      }
      for (const row of (documentItemData ?? []) as any[]) {
        const documentItemId = row.documentItemId ?? row.DocumentItemId ?? row.Id;
        const documentId = row.documentId ?? row.DocumentId;
        try {
          if (existingIds.has(documentItemId)) {
            results.push({ documentItemId, documentId, status: "existente", message: "Ya existe en la base" });
          } else {
            await createDocumentItem(toAmplifyDocumentItem(row));
            results.push({ documentItemId, documentId, status: "nuevo" });
            existingIds.add(documentItemId);
          }
        } catch (e: any) {
          results.push({ documentItemId, documentId, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ documentItemId: -1, documentId: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Items de Documento desde DocumentItem.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID Item</th>
                <th className="px-2 py-1 border">ID Documento</th>
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
                    <td className="border px-2 py-1">{item.documentId ?? "-"}</td>
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
