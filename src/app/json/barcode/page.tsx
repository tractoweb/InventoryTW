"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listBarcodes, createBarcode } from "@/services/barcode-service";
import barcodeData from "@/lib/data/Barcode.json";

interface UploadLog {
  productId: number;
  value: string;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadBarcode() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listBarcodes()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingKeys = new Set(existing.map((b: any) => `${b.productId}|${b.value}`));
      function toAmplifyBarcode(row: any) {
        return {
          productId: row.productId ?? row.ProductId,
          value: row.value ?? row.Value,
        };
      }
      for (const row of (barcodeData ?? []) as any[]) {
        const productId = row.productId ?? row.ProductId;
        const value = row.value ?? row.Value;
        const key = `${productId}|${value}`;
        try {
          if (existingKeys.has(key)) {
            results.push({ productId, value, status: "existente", message: "Ya existe en la base" });
          } else {
            await createBarcode(toAmplifyBarcode(row));
            results.push({ productId, value, status: "nuevo" });
            existingKeys.add(key);
          }
        } catch (e: any) {
          results.push({ productId, value, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ productId: -1, value: "-", status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Códigos de Barras desde Barcode.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">Product ID</th>
                <th className="px-2 py-1 border">Código de Barras</th>
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
                    <td className="border px-2 py-1">{item.productId ?? "-"}</td>
                    <td className="border px-2 py-1">{item.value ?? "-"}</td>
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
