"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listPayments, createPayment } from "@/services/payment-service";
import paymentData from "@/lib/data/Payment.json";

interface UploadLog {
  paymentId: number;
  documentId: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadPayment() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listPayments()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((p: any) => p.paymentId));
      function toAmplifyPayment(row: any) {
        // Acepta todos los formatos posibles de campo
        const paymentId = Number(row.paymentId ?? row.PaymentId ?? row.Id);
        const documentId = Number(row.documentId ?? row.DocumentId);
        const paymentTypeId = Number(row.paymentTypeId ?? row.PaymentTypeId);
        const amount = Number(row.amount ?? row.Amount);
        const date = row.date ?? row.Date ?? null;
        const userId = row.userId ?? row.UserId ?? null;
        const zReportId = row.zReportId ?? row.ZReportId ?? null;
        return { paymentId, documentId, paymentTypeId, amount, date, userId, zReportId };
      }
      let idx = 0;
      for (const row of (paymentData ?? []) as any[]) {
        idx++;
        // Log de depuración: mostrar valores procesados
        const paymentId = Number(row.paymentId ?? row.PaymentId ?? row.Id);
        const documentId = Number(row.documentId ?? row.DocumentId);
        const paymentTypeId = Number(row.paymentTypeId ?? row.PaymentTypeId);
        const amount = Number(row.amount ?? row.Amount);
        const date = row.date ?? row.Date ?? null;
        const userId = row.userId ?? row.UserId ?? null;
        const zReportId = row.zReportId ?? row.ZReportId ?? null;
        // Guardar en el log los valores que se intentan subir
        let logMsg = `Fila ${idx}: paymentId=${paymentId}, documentId=${documentId}, paymentTypeId=${paymentTypeId}, amount=${amount}, date=${date}, userId=${userId}, zReportId=${zReportId}`;
        try {
          if (!paymentId || !documentId) {
            results.push({ paymentId: paymentId || -1, documentId: documentId || -1, status: "error", message: logMsg + " | paymentId o documentId faltante o inválido" });
            continue;
          }
          if (existingIds.has(paymentId)) {
            results.push({ paymentId, documentId, status: "existente", message: logMsg + " | Ya existe en la base" });
          } else {
            await createPayment({ paymentId, documentId, paymentTypeId, amount, date, userId, zReportId });
            results.push({ paymentId, documentId, status: "nuevo", message: logMsg + " | Subido correctamente" });
            existingIds.add(paymentId);
          }
        } catch (e: any) {
          results.push({ paymentId: paymentId || -1, documentId: documentId || -1, status: "error", message: logMsg + ` | Error: ${e.message}` });
        }
      }
    } catch (e: any) {
      results.push({ paymentId: -1, documentId: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Pagos desde Payment.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID Pago</th>
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
                    <td className="border px-2 py-1">{item.paymentId ?? "-"}</td>
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
