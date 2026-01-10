"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listDocuments, createDocument } from "@/services/document-service";
import documentData from "@/lib/data/Document.json";

interface UploadLog {
  documentId: number;
  number: string;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadDocument() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listDocuments()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((d: any) => d.documentId));
      function toAmplifyDocument(row: any) {
        // Transformar el JSON para cumplir con DocumentCreateRequest
        return {
          documentId: Number(row.documentId ?? row.DocumentId ?? row.Id),
          userId: Number(row.userId ?? row.UserId ?? row.user_id ?? 1),
          customerId: row.customerId !== undefined ? Number(row.customerId) : (row.CustomerId !== undefined ? Number(row.CustomerId) : undefined),
          orderNumber: row.orderNumber ?? row.OrderNumber,
          documentTypeId: Number(row.documentTypeId ?? row.DocumentTypeId ?? 1),
          warehouseId: Number(row.warehouseId ?? row.WarehouseId ?? 1),
          date: row.date ? new Date(row.date) : new Date(),
          dueDate: row.dueDate ? new Date(row.dueDate) : undefined,
          referenceDocumentNumber: row.referenceDocumentNumber ?? row.ReferenceDocumentNumber,
          note: row.note ?? row.Note,
          internalNote: row.internalNote ?? row.InternalNote,
          discount: Number(row.discount ?? row.Discount ?? 0),
          discountType: Number(row.discountType ?? row.DiscountType ?? 0),
          discountApplyRule: Number(row.discountApplyRule ?? row.DiscountApplyRule ?? 0),
          serviceType: Number(row.serviceType ?? row.ServiceType ?? 0),
          items: Array.isArray(row.items) ? row.items.map((item: any) => ({
            productId: Number(item.productId ?? item.ProductId),
            quantity: Number(item.quantity ?? item.Quantity ?? 1),
            price: Number(item.price ?? item.Price ?? 0),
            discount: Number(item.discount ?? item.Discount ?? 0),
            discountType: Number(item.discountType ?? item.DiscountType ?? 0),
            taxIds: Array.isArray(item.taxIds ?? item.TaxIds) ? (item.taxIds ?? item.TaxIds).map((t: any) => Number(t)) : [],
          })) : [],
          };
        }
    // ...resto de handleUpload...
    } catch (e) {
      // Puedes agregar manejo de errores aquí si lo deseas
    }
  }
  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Documentos desde Document.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID</th>
                <th className="px-2 py-1 border">Número</th>
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
                    <td className="border px-2 py-1">{item.documentId ?? "-"}</td>
                    <td className="border px-2 py-1">{item.number ?? "-"}</td>
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
