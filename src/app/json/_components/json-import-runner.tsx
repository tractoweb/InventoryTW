"use client";

import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { runJsonImportAction } from "@/actions/json/run-json-import";
import type { JsonImportKind, JsonImportLogRow } from "@/actions/json/run-json-import";

export function JsonImportRunner({
  kind,
  title,
}: {
  kind: JsonImportKind;
  title: string;
}) {
  const [log, setLog] = useState<JsonImportLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runJsonImportAction(kind);
      if (!res.success) {
        setError(res.error ?? "No se pudo ejecutar el importador");
        setLog(res.results ?? []);
      } else {
        setLog(res.results ?? []);
      }
    } catch (e: any) {
      setError(e?.message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : title}
      </Button>

      {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}

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
              <tr key={String(item.id) + i}>
                <td className="border px-2 py-1">{item.id}</td>
                <td className="border px-2 py-1">{item.name ?? ""}</td>
                <td className="border px-2 py-1">{item.status}</td>
                <td className="border px-2 py-1">{item.message ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
