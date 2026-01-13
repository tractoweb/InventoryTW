"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listDocumentItemTaxes, createDocumentItemTax } from "@/services/document-item-tax-service";
import documentItemTaxData from "@/lib/data/DocumentItemTax.json";

interface UploadLog {
  documentItemId: number;
  taxId: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadDocumentItemTax() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listDocumentItemTaxes()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingKeys = new Set(existing.map((d: any) => `${d.documentItemId}|${d.taxId}`));
      function toAmplifyDocumentItemTax(row: any) {
        // Acepta todos los formatos posibles de campo
        const documentItemId = Number(row.documentItemId ?? row.DocumentItemId ?? row.Id);
        const taxId = Number(row.taxId ?? row.TaxId);
        const amount = Number(row.amount ?? row.Amount);
        return { documentItemId, taxId, amount };
      }
      let idx = 0;
      for (const row of (documentItemTaxData ?? []) as any[]) {
        idx++;
        try {
          const documentItemId = Number(row.documentItemId ?? row.DocumentItemId ?? row.Id);
          const taxId = Number(row.taxId ?? row.TaxId);
          const amount = Number(row.amount ?? row.Amount);
          if (!documentItemId || !taxId || !Number.isFinite(amount)) {
            results.push({
              documentItemId: documentItemId || -1,
              taxId: taxId || -1,
              status: "error",
              message: `Fila ${idx}: documentItemId, taxId y amount son obligatorios`,
            });
            continue;
          }
          const key = `${documentItemId}|${taxId}`;
          if (existingKeys.has(key)) {
            results.push({ documentItemId, taxId, status: "existente", message: "Ya existe en la base" });
          } else {
            await createDocumentItemTax(toAmplifyDocumentItemTax(row));
            results.push({ documentItemId, taxId, status: "nuevo" });
            existingKeys.add(key);
          }
        } catch (e: any) {
          results.push({ documentItemId: row.documentItemId ?? row.DocumentItemId ?? row.Id ?? -1, taxId: row.taxId ?? row.TaxId ?? -1, status: "error", message: `Fila ${idx}: ${e.message}` });
        }
      }
    } catch (e: any) {
      results.push({ documentItemId: -1, taxId: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Impuestos de Item Documento desde DocumentItemTax.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID Item</th>
                <th className="px-2 py-1 border">ID Impuesto</th>
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
                    <td className="border px-2 py-1">{item.taxId ?? "-"}</td>
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
