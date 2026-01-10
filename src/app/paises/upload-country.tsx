"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listCountries, createCountry } from "@/services/country-service";
import countryData from "@/lib/data/Country.json";

interface CountryRow {
  Code: string;
  Name: string;
}

interface UploadLog {
  code: string;
  name: string;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadCountry() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      // Obtener todos los países existentes una sola vez
      const existing = await listCountries();
      const existingCodes = new Set((existing || []).map((c: any) => c.code));
      for (const row of countryData as any[]) {
        try {
          if (existingCodes.has(row.Code)) {
            results.push({ code: row.Code, name: row.Name, status: "existente", message: "Ya existe en la base" });
          } else {
            await createCountry({ idCountry: row.Id, name: row.Name, code: row.Code });
            results.push({ code: row.Code, name: row.Name, status: "nuevo" });
            existingCodes.add(row.Code);
          }
        } catch (e: any) {
          results.push({ code: row.Code, name: row.Name, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ code: "-", name: "-", status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Países desde Country.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1">Código</th>
              <th className="border px-2 py-1">Nombre</th>
              <th className="border px-2 py-1">Estado</th>
              <th className="border px-2 py-1">Mensaje</th>
            </tr>
          </thead>
          <tbody>
            {log.map((item, i) => (
              <tr key={item.code + i}>
                <td className="border px-2 py-1">{item.code}</td>
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
