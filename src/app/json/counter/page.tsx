"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listCounters, createCounter } from "@/services/counter-service";
import counterData from "@/lib/data/Counter.json";

interface UploadLog {
  name: string;
  value: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadCounter() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listCounters()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingNames = new Set(existing.map((c: any) => c.name));
      function toAmplifyCounter(row: any) {
        return {
          name: row.name ?? row.Name,
          value: row.value ?? row.Value ?? 0,
        };
      }
      for (const row of (counterData ?? []) as any[]) {
        const name = row.name ?? row.Name;
        const value = row.value ?? row.Value ?? 0;
        try {
          if (existingNames.has(name)) {
            results.push({ name, value, status: "existente", message: "Ya existe en la base" });
          } else {
            await createCounter(toAmplifyCounter(row));
            results.push({ name, value, status: "nuevo" });
            existingNames.add(name);
          }
        } catch (e: any) {
          results.push({ name, value, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ name: "-", value: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Contadores desde Counter.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">Nombre</th>
                <th className="px-2 py-1 border">Valor</th>
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
                    <td className="border px-2 py-1">{item.name ?? "-"}</td>
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
