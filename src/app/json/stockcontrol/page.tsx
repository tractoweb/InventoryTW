"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listStockControls, createStockControl } from "@/services/stock-control-service";
import stockControlData from "@/lib/data/StockControl.json";

interface UploadLog {
  stockControlId: number;
  productId: number;
  customerId: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadStockControl() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listStockControls()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((s: any) => Number((s as any).stockControlId)));

      function toBool(value: any): boolean {
        return value === true || value === 1 || value === "1" || value === "true";
      }

      function toAmplifyStockControl(row: any) {
        return {
          stockControlId: Number(row.stockControlId ?? row.StockControlId ?? row.id ?? row.Id),
          productId: Number(row.productId ?? row.ProductId),
          customerId:
            row.customerId === null || row.customerId === undefined
              ? row.CustomerId === null || row.CustomerId === undefined
                ? undefined
                : Number(row.CustomerId)
              : Number(row.customerId),
          reorderPoint: Number(row.reorderPoint ?? row.ReorderPoint ?? 0),
          preferredQuantity: Number(row.preferredQuantity ?? row.PreferredQuantity ?? 0),
          isLowStockWarningEnabled: toBool(
            row.isLowStockWarningEnabled ?? row.IsLowStockWarningEnabled ?? true
          ),
          lowStockWarningQuantity: Number(
            row.lowStockWarningQuantity ?? row.LowStockWarningQuantity ?? 0
          ),
        };
      }
      for (const row of (stockControlData ?? []) as any[]) {
        const stockControlId = Number(row.stockControlId ?? row.StockControlId ?? row.id ?? row.Id);
        const productId = Number(row.productId ?? row.ProductId);
        const customerId = row.customerId ?? row.CustomerId;
        try {
          if (!stockControlId || !productId) {
            results.push({
              stockControlId: stockControlId || -1,
              productId: productId || -1,
              customerId: customerId ?? -1,
              status: "error",
              message: "Id (stockControlId) y productId son obligatorios",
            });
            continue;
          }
          if (existingIds.has(stockControlId)) {
            results.push({ stockControlId, productId, customerId, status: "existente", message: "Ya existe en la base" });
          } else {
            await createStockControl(toAmplifyStockControl(row));
            results.push({ stockControlId, productId, customerId, status: "nuevo" });
            existingIds.add(stockControlId);
          }
        } catch (e: any) {
          results.push({ stockControlId, productId, customerId, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ stockControlId: -1, productId: -1, customerId: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Control de Stock desde StockControl.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID StockControl</th>
                <th className="px-2 py-1 border">ID Producto</th>
                <th className="px-2 py-1 border">ID Cliente</th>
                <th className="px-2 py-1 border">Estado</th>
                <th className="px-2 py-1 border">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-gray-500 py-2">No se han subido registros.</td></tr>
              ) : (
                log.map((item, i) => (
                  <tr key={i} className={
                    item.status === "nuevo" ? "text-green-600" :
                    item.status === "existente" ? "text-gray-500" :
                    "text-red-600"
                  }>
                    <td className="border px-2 py-1">{item.stockControlId ?? "-"}</td>
                    <td className="border px-2 py-1">{item.productId ?? "-"}</td>
                    <td className="border px-2 py-1">{item.customerId ?? "-"}</td>
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
