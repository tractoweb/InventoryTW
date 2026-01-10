"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listStocks, createStock } from "@/services/stock-service";
import stockData from "@/lib/data/Stock.json";

interface UploadLog {
  productId: number;
  warehouseId: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadStock() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listStocks()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingKeys = new Set(existing.map((s: any) => `${s.productId}|${s.warehouseId}`));
      function toAmplifyStock(row: any) {
        return {
          productId: row.productId ?? row.ProductId,
          warehouseId: row.warehouseId ?? row.WarehouseId,
          quantity: row.quantity ?? row.Quantity ?? 0,
        };
      }
      for (const row of (stockData ?? []) as any[]) {
        const productId = row.productId ?? row.ProductId;
        const warehouseId = row.warehouseId ?? row.WarehouseId;
        const key = `${productId}|${warehouseId}`;
        try {
          if (existingKeys.has(key)) {
            results.push({ productId, warehouseId, status: "existente", message: "Ya existe en la base" });
          } else {
            await createStock(toAmplifyStock(row));
            results.push({ productId, warehouseId, status: "nuevo" });
            existingKeys.add(key);
          }
        } catch (e: any) {
          results.push({ productId, warehouseId, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ productId: -1, warehouseId: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Stock desde Stock.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">Product ID</th>
                <th className="px-2 py-1 border">Warehouse ID</th>
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
                    <td className="border px-2 py-1">{item.warehouseId ?? "-"}</td>
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
