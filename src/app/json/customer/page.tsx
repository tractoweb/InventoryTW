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

  const toBool = (value: any, defaultValue: boolean) => {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "si") return true;
      if (normalized === "0" || normalized === "false" || normalized === "no") return false;
    }
    return defaultValue;
  };

  const toInt = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listCustomers()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((c: any) => toInt(c.idCustomer)).filter((v: any) => v !== null));
      function toAmplifyCustomer(row: any) {
        const isEnabled = toBool(row.isEnabled ?? row.IsEnabled, true);
        const isCustomer = toBool(row.isCustomer ?? row.IsCustomer, false);
        const isSupplier = toBool(row.isSupplier ?? row.IsSupplier, true);

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
          isEnabled,
          isCustomer,
          isSupplier,
          dueDatePeriod: row.dueDatePeriod ?? row.DueDatePeriod ?? 0,
          isTaxExempt: row.isTaxExempt ?? row.IsTaxExempt ?? false,
        };
      }
      for (const row of (customerData ?? []) as any[]) {
        const id = toInt(row.idCustomer ?? row.Id ?? row.id);
        const name = row.name ?? row.Name;
        try {
          if (id === null) {
            results.push({ id: -1, name: name ?? "-", status: "error", message: "Falta idCustomer/Id válido" });
            continue;
          }
          if (!name || typeof name !== "string") {
            results.push({ id, name: name ?? "-", status: "error", message: "Falta Name" });
            continue;
          }

          if (existingIds.has(id)) {
            results.push({ id, name, status: "existente", message: "Ya existe en la base" });
          } else {
            await createCustomer(toAmplifyCustomer(row));
            results.push({ id, name, status: "nuevo" });
            existingIds.add(id);
          }
        } catch (e: any) {
          results.push({ id: id ?? -1, name: name ?? "-", status: "error", message: e.message });
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
        {loading ? "Subiendo..." : "Subir Proveedores desde Customer.json"}
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
