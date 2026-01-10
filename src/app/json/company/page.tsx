"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listCompanies, createCompany } from "@/services/company-service";
import companyData from "@/lib/data/Company.json";

interface UploadLog {
  id: number;
  name: string;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadCompany() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existing = await listCompanies();
      const existingIds = new Set((existing || []).map((c: any) => c.idCompany));
      function toAmplifyCompany(row: any) {
        return {
          idCompany: row.Id,
          name: row.Name,
          address: row.Address ?? "",
          postalCode: row.PostalCode ?? "",
          city: row.City ?? "",
          countryId: row.CountryId ?? null,
          taxNumber: row.TaxNumber ?? "",
          email: row.Email ?? "",
          phoneNumber: row.PhoneNumber ?? "",
          logo: row.Logo ?? "",
          bankAccountNumber: row.BankAccountNumber ?? "",
          bankDetails: row.BankDetails ?? "",
          streetName: row.StreetName ?? "",
          additionalStreetName: row.AdditionalStreetName ?? "",
          buildingNumber: row.BuildingNumber ?? "",
          plotIdentification: row.PlotIdentification ?? "",
          citySubdivisionName: row.CitySubdivisionName ?? "",
          countrySubentity: row.CountrySubentity ?? "",
        };
      }
      for (const row of (companyData ?? []) as any[]) {
        try {
          if (existingIds.has(row.Id)) {
            results.push({ id: row.Id, name: row.Name, status: "existente", message: "Ya existe en la base" });
          } else {
            await createCompany(toAmplifyCompany(row));
            results.push({ id: row.Id, name: row.Name, status: "nuevo" });
            existingIds.add(row.Id);
          }
        } catch (e: any) {
          results.push({ id: row.Id, name: row.Name, status: "error", message: e.message });
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
        {loading ? "Subiendo..." : "Subir Empresas desde Company.json"}
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
