"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listProductGroups, createProductGroup } from "@/services/product-group-service";
import productGroupData from "@/lib/data/ProductGroup.json";

interface ProductGroupRow {
  Id: number;
  Name: string;
  ParentGroupId?: number;
  Color?: string;
  Image?: string;
  Rank?: number;
}

interface UploadLog {
  id: number;
  name: string;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadProductGroup() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      // Obtener todos los grupos existentes una sola vez
      const existing = await listProductGroups();
      const existingIds = new Set((existing || []).map((g: any) => g.idProductGroup));
      for (const row of productGroupData as any[]) {
        try {
          if (existingIds.has(row.Id)) {
            results.push({ id: row.Id, name: row.Name, status: "existente", message: "Ya existe en la base" });
          } else {
            await createProductGroup({
              idProductGroup: row.Id,
              name: row.Name,
              parentGroupId: row.ParentGroupId,
              color: row.Color,
              image: row.Image,
              rank: row.Rank,
            });
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
        {loading ? "Subiendo..." : "Subir Grupos desde ProductGroup.json"}
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
