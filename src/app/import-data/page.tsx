"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";

const FILES = [
  "Country", "Currency", "Company", "Tax", "Warehouse", "ProductGroup", "PaymentType", "DocumentType", "DocumentCategory",
  "Product", "Barcode", "Stock", "Customer", "User", "Counter", "LoyaltyCard", "CustomerDiscount", "ProductTax",
  "Document", "DocumentItem", "DocumentItemTax", "Payment", "PosOrder", "PosOrderItem", "Kardex", "KardexHistory",
  "StockControl", "StartingCash", "ZReport", "AuditLog", "SessionConfig", "ApplicationSettings", "DocumentNumber", "ProductComment", "Template"
];


export default function DataImportPage() {
  const [loading, setLoading] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Record<string, string>>({});
  // Solo un histórico por intento, no acumulativo
  const [history, setHistory] = React.useState<{ file: string; logs: Array<{ status: string; item: any; error?: string }> } | null>(null);

  async function handleImport(file: string) {
    setLoading(file);
    setResult((r) => ({ ...r, [file]: "" }));
    try {
      const res = await fetch(`/api/import-json?file=${file}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult((r) => ({ ...r, [file]: `✔️ ${data.message}` }));
        setHistory({ file, logs: data.log || [] });
      } else {
        setResult((r) => ({ ...r, [file]: `❌ ${data.message || "Error desconocido"}` }));
        setHistory({ file, logs: data.log || [] });
      }
    } catch (err: any) {
      setResult((r) => ({ ...r, [file]: `❌ ${err.message}` }));
      setHistory({ file, logs: [{ status: 'error', item: {}, error: err.message }] });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <Card className="p-8 flex flex-col gap-6">
        <div className="flex items-center gap-3 mb-2">
          <UploadCloud size={32} className="text-blue-500" />
          <h2 className="text-xl font-bold">Importar datos por archivo</h2>
        </div>
        <p className="text-gray-600 text-sm mb-4">
          Sube cada archivo <b>.json</b> de <code>/src/lib/data</code> de forma individual. El sistema evita duplicados automáticamente.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {FILES.map((file) => (
            <div key={file} className="flex flex-col items-center gap-1">
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleImport(file)}
                disabled={loading === file}
              >
                {loading === file ? "Importando..." : file}
              </Button>
              {result[file] && (
                <span className="text-xs text-center" style={{ color: result[file].startsWith("✔") ? "green" : "red" }}>{result[file]}</span>
              )}
            </div>
          ))}
        </div>
        {/* Histórico de importación: solo el último intento */}
        <div className="mt-8">
          <h3 className="font-semibold mb-2 text-base">Histórico de importación</h3>
          {!history && (
            <div className="text-gray-500 text-sm">No hay histórico aún.</div>
          )}
          {history && (
            <div className="mb-4">
              <div className="font-medium text-sm mb-1">{history.file}</div>
              <div className="border rounded bg-gray-50 p-2 max-h-48 overflow-auto">
                {history.logs.length === 0 && <div className="text-xs text-gray-400">Sin registros.</div>}
                {history.logs.map((log, idx) => (
                  <div key={idx} className="text-xs flex gap-2 items-center py-0.5">
                    <span style={{ color: log.status === 'creado' ? 'green' : log.status === 'duplicado' ? 'orange' : 'red' }}>
                      {log.status === 'creado' && '✔️'}
                      {log.status === 'duplicado' && '⚠️'}
                      {log.status === 'error' && '❌'}
                    </span>
                    <span className="truncate max-w-xs" title={JSON.stringify(log.item)}>
                      {log.item?.id || log.item?.code || log.item?.username || '[sin id]'}
                    </span>
                    <span className="italic text-gray-500">
                      {log.status === 'creado' && 'Creado'}
                      {log.status === 'duplicado' && 'Duplicado'}
                      {log.status === 'error' && `Error: ${log.error}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
