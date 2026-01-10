"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listStartingCash, createStartingCash } from "@/services/starting-cash-service";
import startingCashData from "@/lib/data/StartingCash.json";

interface UploadLog {
  startingCashId: number;
  userId: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadStartingCash() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listStartingCash()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((s: any) => s.startingCashId));
      function toAmplifyStartingCash(row: any) {
        return {
          startingCashId: row.startingCashId ?? row.StartingCashId ?? row.Id,
          userId: row.userId ?? row.UserId,
          // ...otros campos según modelo Amplify
        };
      }
      for (const row of (startingCashData ?? []) as any[]) {
        const startingCashId = row.startingCashId ?? row.StartingCashId ?? row.Id;
        const userId = row.userId ?? row.UserId;
        try {
          if (existingIds.has(startingCashId)) {
            results.push({ startingCashId, userId, status: "existente", message: "Ya existe en la base" });
          } else {
            await createStartingCash(toAmplifyStartingCash(row));
            results.push({ startingCashId, userId, status: "nuevo" });
            existingIds.add(startingCashId);
          }
        } catch (e: any) {
          results.push({ startingCashId, userId, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ startingCashId: -1, userId: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Caja Inicial desde StartingCash.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID Caja</th>
                <th className="px-2 py-1 border">ID Usuario</th>
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
                    <td className="border px-2 py-1">{item.startingCashId ?? "-"}</td>
                    <td className="border px-2 py-1">{item.userId ?? "-"}</td>
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
