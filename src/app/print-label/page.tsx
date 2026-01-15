"use client";
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LabelData } from "@/types/label.types";
import { generateProductLabel } from "@/utils/zplGenerator";
import { getDefaultPrinter, loadBrowserPrintSdk, sendZplWithRetry } from "@/lib/browserprint-client";

export default function PrintLabelPage() {
  // Ejemplo de datos de etiqueta
  const exampleLabel: LabelData = {
    nombreProducto: "TRACTO AGRICOLA",
    codigoBarras: "CM2205-BONEM",
    lote: "16-7",
    fecha: "11/2025",
  };

  useEffect(() => {
    // Carga el SDK vía helper (usa NEXT_PUBLIC_BROWSERPRINT_PORT, default 9101)
    loadBrowserPrintSdk().catch(() => {
      // Error is handled on print attempt
    });
  }, []);

  const handlePrint = async () => {
    const zpl = generateProductLabel(exampleLabel);
    try {
      const device = await getDefaultPrinter();
      await sendZplWithRetry(device, zpl, { timeoutMs: 6000, retries: 2, retryDelayMs: 250 });
      alert("Etiqueta enviada a la impresora");
    } catch (e: unknown) {
      alert(
        e instanceof Error
          ? `Error al imprimir: ${e.message}`
          : `Error al imprimir: ${String(e)}`
      );
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Impresión de Etiqueta Zebra (USB)</h1>
      <Button onClick={handlePrint}>Imprimir etiqueta de ejemplo (USB)</Button>
      <div className="mt-6 text-sm text-muted-foreground">
        <p>Esta página usa Zebra Browser Print para enviar la etiqueta a la impresora USB conectada a tu PC.</p>
        <p>Requiere que el servicio Zebra Browser Print esté instalado y ejecutándose.</p>
      </div>
    </div>
  );
}
