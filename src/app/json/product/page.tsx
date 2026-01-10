"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listProducts, createProduct } from "@/services/product-service";
import productData from "@/lib/data/Product.json";

interface UploadLog {
  id: number;
  name: string;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadProduct() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listProducts()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((c: any) => c.idProduct));
      function toAmplifyProduct(row: any) {
        return {
          idProduct: row.idProduct ?? row.Id ?? row.id,
          name: row.name ?? row.Name,
          code: row.code ?? row.Code ?? "",
          plu: row.plu ?? row.Plu,
          measurementUnit: row.measurementUnit ?? row.MeasurementUnit,
          price: row.price ?? row.Price ?? 0,
          isTaxInclusivePrice: row.isTaxInclusivePrice ?? row.IsTaxInclusivePrice ?? true,
          currencyId: row.currencyId ?? row.CurrencyId,
          isPriceChangeAllowed: row.isPriceChangeAllowed ?? row.IsPriceChangeAllowed ?? false,
          isService: row.isService ?? row.IsService ?? false,
          isUsingDefaultQuantity: row.isUsingDefaultQuantity ?? row.IsUsingDefaultQuantity ?? true,
          isEnabled: row.isEnabled ?? row.IsEnabled ?? true,
          description: row.description ?? row.Description,
          cost: row.cost ?? row.Cost ?? 0,
          markup: row.markup ?? row.Markup ?? 0,
          image: row.image ?? row.Image,
          color: row.color ?? row.Color,
          ageRestriction: row.ageRestriction ?? row.AgeRestriction,
          lastPurchasePrice: row.lastPurchasePrice ?? row.LastPurchasePrice ?? 0,
          rank: row.rank ?? row.Rank,
          productGroupId: row.productGroupId ?? row.ProductGroupId,
        };
      }
      for (const row of (productData ?? []) as any[]) {
        const id = row.idProduct ?? row.Id ?? row.id;
        const name = row.name ?? row.Name;
        try {
          if (existingIds.has(id)) {
            results.push({ id, name, status: "existente", message: "Ya existe en la base" });
          } else {
            await createProduct(toAmplifyProduct(row));
            results.push({ id, name, status: "nuevo" });
            existingIds.add(id);
          }
        } catch (e: any) {
          results.push({ id, name, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ id: -1, name: "-", status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Productos desde Product.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID</th>
                <th className="px-2 py-1 border">Nombre</th>
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
                    <td className="border px-2 py-1">{item.id ?? "-"}</td>
                    <td className="border px-2 py-1">{item.name ?? "-"}</td>
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
