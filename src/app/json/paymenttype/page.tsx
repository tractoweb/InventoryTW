"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listPaymentTypes, createPaymentType } from "@/services/paymenttype-service";
import paymentTypeData from "@/lib/data/PaymentType.json";

function toAmplifyPaymentType(row: any) {
  return {
    paymentTypeId: row.Id,
    name: row.Name,
    code: row.Code ?? "",
    isCustomerRequired: !!row.IsCustomerRequired,
    isFiscal: !!row.IsFiscal,
    isSlipRequired: !!row.IsSlipRequired,
    isChangeAllowed: !!row.IsChangeAllowed,
    ordinal: row.Ordinal ?? 0,
    isEnabled: !!row.IsEnabled,
    isQuickPayment: !!row.IsQuickPayment,
    openCashDrawer: !!row.OpenCashDrawer,
    shortcutKey: row.ShortcutKey ?? "",
    markAsPaid: row.MarkAsPaid !== undefined ? !!row.MarkAsPaid : true,
  };
}

interface UploadLog {
  id: number;
  name: string;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadPaymentType() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existing = await listPaymentTypes();
      const existingIds = new Set((existing || []).map((p: any) => p.paymentTypeId));
      for (const row of (paymentTypeData ?? []) as any[]) {
        try {
          if (existingIds.has(row.Id)) {
            results.push({ id: row.Id, name: row.Name, status: "existente", message: "Ya existe en la base" });
          } else {
            await createPaymentType(toAmplifyPaymentType(row));
            results.push({ id: row.Id, name: row.Name, status: "nuevo" });
            existingIds.add(row.Id);
          }
        } catch (e: any) {
          results.push({ id: row.Id, name: row.Name, status: "error", message: e.message });
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
        {loading ? "Subiendo..." : "Subir Tipos de Pago desde PaymentType.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1">ID</th>
              <th className="border px-2 py-1">Nombre</th>
              <th className="border px-2 py-1">Estado</th>
              <th className="border px-2 py-1">Mensaje</th>
            </tr>
          </thead>
          <tbody>
            {log.map((item, i) => (
              <tr key={item.id + i}>
                <td className="border px-2 py-1">{item.id}</td>
                <td className="border px-2 py-1">{item.name}</td>
                <td className="border px-2 py-1">{item.status}</td>
                <td className="border px-2 py-1">{item.message || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
