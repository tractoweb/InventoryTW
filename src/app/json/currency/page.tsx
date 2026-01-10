"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listCurrencies, createCurrency } from "@/services/currency-service";
import currencyData from "@/lib/data/Currency.json";

interface UploadLog {
  id: number;
  name: string;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadCurrency() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existing = (await listCurrencies()) ?? [];
      const existingIds = new Set(existing.map((c: any) => c.idCurrency));
      function toAmplifyCurrency(row: any) {
        // Soporta ambos formatos: antiguo (Id, Name, Code) y nuevo (idCurrency, name, code)
        return {
          idCurrency: row.idCurrency ?? row.Id,
          name: row.name ?? row.Name,
          code: row.code ?? row.Code ?? "",
        };
      }
      for (const row of (currencyData ?? []) as any[]) {
        const id = row.idCurrency ?? row.Id;
        const name = row.name ?? row.Name;
        try {
          if (existingIds.has(id)) {
            results.push({ id, name, status: "existente", message: "Ya existe en la base" });
          } else {
            await createCurrency(toAmplifyCurrency(row));
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
        {loading ? "Subiendo..." : "Subir Monedas desde Currency.json"}
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
