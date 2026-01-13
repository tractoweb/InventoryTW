"use client";
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LabelData } from "@/types/label.types";
import { generateProductLabel } from "@/utils/zplGenerator";

export default function PrintLabelPage() {
  // Ejemplo de datos de etiqueta
  const exampleLabel: LabelData = {
    nombreProducto: "TRACTO AGRICOLA",
    codigoBarras: "CM2205-BONEM",
    lote: "16-7",
    fecha: "11/2025",
  };

  useEffect(() => {
    // Inyecta el script de Browser Print si no está presente
    if (!document.getElementById('zebra-browser-print')) {
      const script = document.createElement('script');
      script.id = 'zebra-browser-print';
      script.src = 'http://localhost:9100/BrowserPrint-3.0.216.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handlePrint = () => {
    const zpl = generateProductLabel(exampleLabel);
    // @ts-ignore
    if (window.BrowserPrint) {
      // @ts-ignore
      window.BrowserPrint.getDefaultDevice("printer", (device) => {
        device.send(zpl, () => {
          alert("Etiqueta enviada a la impresora");
        }, (error: unknown) => {
          alert("Error al imprimir: " + String(error));
        });
      });
    } else {
      alert("Zebra Browser Print no está disponible. ¿Está instalado y corriendo?");
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
