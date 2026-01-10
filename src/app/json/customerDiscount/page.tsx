"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listCustomerDiscounts, createCustomerDiscount } from "@/services/customer-discount-service";
import customerDiscountData from "@/lib/data/CustomerDiscount.json";

interface UploadLog {
  customerDiscountId: number;
  customerId: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadCustomerDiscount() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listCustomerDiscounts()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((c: any) => c.customerDiscountId));
      function toAmplifyCustomerDiscount(row: any) {
        return {
          customerDiscountId: row.customerDiscountId ?? row.CustomerDiscountId ?? row.id,
          customerId: row.customerId ?? row.CustomerId,
          type: row.type ?? row.Type ?? 0,
          uid: row.uid ?? row.Uid,
          value: row.value ?? row.Value ?? 0,
        };
      }
      for (const row of (customerDiscountData ?? []) as any[]) {
        const customerDiscountId = row.customerDiscountId ?? row.CustomerDiscountId ?? row.id;
        const customerId = row.customerId ?? row.CustomerId;
        try {
          if (existingIds.has(customerDiscountId)) {
            results.push({ customerDiscountId, customerId, status: "existente", message: "Ya existe en la base" });
          } else {
            await createCustomerDiscount(toAmplifyCustomerDiscount(row));
            results.push({ customerDiscountId, customerId, status: "nuevo" });
            existingIds.add(customerDiscountId);
          }
        } catch (e: any) {
          results.push({ customerDiscountId, customerId, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ customerDiscountId: -1, customerId: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Descuentos de Cliente desde CustomerDiscount.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID Descuento</th>
                <th className="px-2 py-1 border">ID Cliente</th>
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
                    <td className="border px-2 py-1">{item.customerDiscountId ?? "-"}</td>
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
