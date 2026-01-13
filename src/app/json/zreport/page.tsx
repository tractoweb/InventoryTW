"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listZReports, createZReport } from "@/services/zreport-service";
import zReportData from "@/lib/data/ZReport.json";

interface UploadLog {
  number: number;
  fromDocumentId: number;
  toDocumentId: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadZReport() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listZReports()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingNumbers = new Set(existing.map((z: any) => z.number));

      function toDateTimeISO(value: any): string | undefined {
        if (!value) return undefined;
        if (value instanceof Date) return value.toISOString();
        if (typeof value === "string") {
          const trimmed = value.trim();
          const [datePart, rawTimePart] = trimmed.split(" ");
          if (datePart && rawTimePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            const [hhmmss, fraction = ""] = rawTimePart.split(".");
            const ms = fraction ? String(fraction).padEnd(3, "0").slice(0, 3) : "000";
            const isoCandidate = `${datePart}T${hhmmss}.${ms}`;
            const d = new Date(isoCandidate);
            if (!Number.isNaN(d.getTime())) return d.toISOString();
          }
        }
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return undefined;
        return d.toISOString();
      }

      function toAmplifyZReport(row: any) {
        return {
          number: Number(row.number ?? row.Number),
          fromDocumentId: Number(row.fromDocumentId ?? row.FromDocumentId),
          toDocumentId: Number(row.toDocumentId ?? row.ToDocumentId),
          dateCreated: toDateTimeISO(row.dateCreated ?? row.DateCreated) ?? new Date().toISOString(),
        };
      }
      for (const row of (zReportData ?? []) as any[]) {
        const number = Number(row.number ?? row.Number);
        const fromDocumentId = Number(row.fromDocumentId ?? row.FromDocumentId);
        const toDocumentId = Number(row.toDocumentId ?? row.ToDocumentId);
        try {
          if (
            !Number.isFinite(number) ||
            !Number.isFinite(fromDocumentId) ||
            !Number.isFinite(toDocumentId)
          ) {
            results.push({
              number: number || -1,
              fromDocumentId: fromDocumentId || -1,
              toDocumentId: toDocumentId || -1,
              status: "error",
              message: "number, fromDocumentId y toDocumentId son obligatorios",
            });
            continue;
          }
          if (existingNumbers.has(number)) {
            results.push({ number, fromDocumentId, toDocumentId, status: "existente", message: "Ya existe en la base" });
          } else {
            await createZReport(toAmplifyZReport(row));
            results.push({ number, fromDocumentId, toDocumentId, status: "nuevo" });
            existingNumbers.add(number);
          }
        } catch (e: any) {
          results.push({ number, fromDocumentId, toDocumentId, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ number: -1, fromDocumentId: -1, toDocumentId: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Z-Reports desde ZReport.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">Número</th>
                <th className="px-2 py-1 border">Desde Documento</th>
                <th className="px-2 py-1 border">Hasta Documento</th>
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
                    <td className="border px-2 py-1">{item.number ?? "-"}</td>
                    <td className="border px-2 py-1">{item.fromDocumentId ?? "-"}</td>
                    <td className="border px-2 py-1">{item.toDocumentId ?? "-"}</td>
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
