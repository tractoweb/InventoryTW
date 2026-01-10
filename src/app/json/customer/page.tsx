"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listCustomers, createCustomer } from "@/services/customer-service";
import customerData from "@/lib/data/Customer.json";

interface UploadLog {
  id: number;
  name: string;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadCustomer() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listCustomers()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((c: any) => c.idCustomer));
      function toAmplifyCustomer(row: any) {
        return {
          idCustomer: row.idCustomer ?? row.Id ?? row.id,
          code: row.code ?? row.Code,
          name: row.name ?? row.Name,
          taxNumber: row.taxNumber ?? row.TaxNumber,
          address: row.address ?? row.Address,
          postalCode: row.postalCode ?? row.PostalCode,
          city: row.city ?? row.City,
          countryId: row.countryId ?? row.CountryId,
          email: row.email ?? row.Email,
          phoneNumber: row.phoneNumber ?? row.PhoneNumber,
          isEnabled: row.isEnabled ?? row.IsEnabled ?? true,
          isCustomer: row.isCustomer ?? row.IsCustomer ?? true,
          isSupplier: row.isSupplier ?? row.IsSupplier ?? true,
          dueDatePeriod: row.dueDatePeriod ?? row.DueDatePeriod ?? 0,
          isTaxExempt: row.isTaxExempt ?? row.IsTaxExempt ?? false,
        };
      }
      for (const row of (customerData ?? []) as any[]) {
        const id = row.idCustomer ?? row.Id ?? row.id;
        const name = row.name ?? row.Name;
        try {
          if (existingIds.has(id)) {
            results.push({ id, name, status: "existente", message: "Ya existe en la base" });
          } else {
            await createCustomer(toAmplifyCustomer(row));
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
        {loading ? "Subiendo..." : "Subir Clientes desde Customer.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID</th>
                <th className="px-2 py-1 border">Nombre</th>
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
                    <td className="border px-2 py-1">{item.id ?? "-"}</td>
                    <td className="border px-2 py-1">{item.name ?? "-"}</td>
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
