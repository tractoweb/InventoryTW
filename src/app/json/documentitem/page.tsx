"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listDocumentItems, createDocumentItem } from "@/services/document-item-service";
import documentItemData from "@/lib/data/DocumentItem.json";

interface UploadLog {
  documentItemId: number;
  documentId: number;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadDocumentItem() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listDocumentItems()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((d: any) => d.documentItemId));
      function toAmplifyDocumentItem(row: any) {
        const documentItemId = Number(row.documentItemId ?? row.DocumentItemId ?? row.Id);
        const documentId = Number(row.documentId ?? row.DocumentId);
        const productId = Number(row.productId ?? row.ProductId);
        const quantity = Number(row.quantity ?? row.Quantity);
        const price = Number(row.price ?? row.Price);

        return {
          documentItemId,
          documentId,
          productId,
          quantity,
          expectedQuantity: Number(row.expectedQuantity ?? row.ExpectedQuantity ?? 0),
          priceBeforeTax: Number(row.priceBeforeTax ?? row.PriceBeforeTax ?? 0),
          price,
          discount: Number(row.discount ?? row.Discount ?? 0),
          discountType: Number(row.discountType ?? row.DiscountType ?? 0),
          productCost: Number(row.productCost ?? row.ProductCost ?? 0),
          priceBeforeTaxAfterDiscount: Number(
            row.priceBeforeTaxAfterDiscount ?? row.PriceBeforeTaxAfterDiscount ?? 0
          ),
          priceAfterDiscount: Number(row.priceAfterDiscount ?? row.PriceAfterDiscount ?? 0),
          total: Number(row.total ?? row.Total ?? 0),
          totalAfterDocumentDiscount: Number(
            row.totalAfterDocumentDiscount ?? row.TotalAfterDocumentDiscount ?? 0
          ),
          discountApplyRule: Number(row.discountApplyRule ?? row.DiscountApplyRule ?? 0),
        };
      }
      for (const row of (documentItemData ?? []) as any[]) {
        const documentItemId = Number(row.documentItemId ?? row.DocumentItemId ?? row.Id);
        const documentId = Number(row.documentId ?? row.DocumentId);
        try {
          const productId = Number(row.productId ?? row.ProductId);
          const quantity = Number(row.quantity ?? row.Quantity);
          const price = Number(row.price ?? row.Price);

          if (
            !documentItemId ||
            !documentId ||
            !productId ||
            !Number.isFinite(quantity) ||
            !Number.isFinite(price)
          ) {
            results.push({
              documentItemId: documentItemId || -1,
              documentId: documentId || -1,
              status: "error",
              message: "documentItemId, documentId, productId, quantity y price son obligatorios",
            });
            continue;
          }

          if (existingIds.has(documentItemId)) {
            results.push({ documentItemId, documentId, status: "existente", message: "Ya existe en la base" });
          } else {
            await createDocumentItem(toAmplifyDocumentItem(row));
            results.push({ documentItemId, documentId, status: "nuevo" });
            existingIds.add(documentItemId);
          }
        } catch (e: any) {
          results.push({ documentItemId, documentId, status: "error", message: e.message });
        }
      }
    } catch (e: any) {
      results.push({ documentItemId: -1, documentId: -1, status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Items de Documento desde DocumentItem.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID Item</th>
                <th className="px-2 py-1 border">ID Documento</th>
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
                    <td className="border px-2 py-1">{item.documentItemId ?? "-"}</td>
                    <td className="border px-2 py-1">{item.documentId ?? "-"}</td>
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
