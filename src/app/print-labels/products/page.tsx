"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { generateProductLabel } from "@/utils/zplGenerator";
import { LabelData } from "@/types/label.types";
import { inventoryService } from "@/services/inventory-service";

interface Product {
  idProduct: string;
  name: string;
  code: string;
  measurementUnit: string;
  updatedAt?: string;
}

export default function PrintLabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    inventoryService.searchProducts("").then((res: any) => {
      if (res.success && res.products) {
        setProducts(res.products.map((p: any) => ({
          idProduct: p.idProduct || p.id,
          name: p.name,
          code: p.code,
          measurementUnit: p.measurementUnit,
          updatedAt: p.updatedAt,
        })));
      }
      setLoading(false);
    });
  }, []);

  const handleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[id] = 1;
      else delete next[id];
      return next;
    });
  };

  const handleQtyChange = (id: string, qty: number) => {
    setSelected((prev) => ({ ...prev, [id]: qty }));
  };

  const handlePrint = () => {
    setPrinting(true);
    setMessage(null);
    const toPrint = products.filter((p) => selected[p.idProduct]);
    let sent = 0;
    let errors = 0;
    const printNext = (idx: number) => {
      if (idx >= toPrint.length) {
        setPrinting(false);
        setMessage(errors === 0 ? "¡Etiquetas enviadas correctamente!" : `Algunas etiquetas fallaron (${errors})`);
        return;
      }
      const prod = toPrint[idx];
      const qty = selected[prod.idProduct];
      const label: LabelData = {
        nombreProducto: prod.name,
        codigoBarras: prod.code,
        lote: prod.measurementUnit,
        fecha: prod.updatedAt ? prod.updatedAt.split("T")[0] : "",
      };
      const zpl = generateProductLabel(label);
      // @ts-ignore
      if (window.BrowserPrint) {
        // @ts-ignore
        window.BrowserPrint.getDefaultDevice("printer", (device) => {
          let count = 0;
          const sendLabel = () => {
            device.send(zpl, () => {
              count++;
              if (count < qty) sendLabel();
              else printNext(idx + 1);
            }, (error: any) => {
              errors++;
              printNext(idx + 1);
            });
          };
          sendLabel();
        });
      } else {
        setPrinting(false);
        setMessage("Zebra Browser Print no está disponible.");
      }
    };
    printNext(0);
  };

  // Ajuste de nombre para salto de línea y centrado
  const formatName = (name: string) => {
    if (name.length <= 20) return [name];
    const words = name.split(" ");
    let line = "";
    const lines = [];
    for (const word of words) {
      if ((line + " " + word).trim().length > 20) {
        lines.push(line.trim());
        line = word;
      } else {
        line += " " + word;
      }
    }
    if (line) lines.push(line.trim());
    return lines;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Impresión de Etiquetas Zebra</h1>
      {loading ? <div>Cargando productos...</div> : (
        <table className="min-w-full border text-sm mb-6">
          <thead>
            <tr>
              <th></th>
              <th>Producto</th>
              <th>Código</th>
              <th>Ubicación</th>
              <th>Fecha actualización</th>
              <th>Cantidad</th>
              <th>Preview</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.idProduct}>
                <td><Checkbox checked={!!selected[p.idProduct]} onCheckedChange={(v) => handleSelect(p.idProduct, !!v)} /></td>
                <td>{p.name}</td>
                <td>{p.code}</td>
                <td>{p.measurementUnit}</td>
                <td>{p.updatedAt ? p.updatedAt.split("T")[0] : ""}</td>
                <td>
                  {selected[p.idProduct] && (
                    <Input type="number" min={1} value={selected[p.idProduct]} onChange={e => handleQtyChange(p.idProduct, Math.max(1, Number(e.target.value)))} className="w-16" />
                  )}
                </td>
                <td>
                  {selected[p.idProduct] && (
                    <div className="border p-2 bg-white" style={{ width: 120, height: 90 }}>
                      {formatName(p.name).map((line, i) => (
                        <div key={i} style={{ textAlign: 'center', fontSize: 10 }}>{line}</div>
                      ))}
                      <div style={{ textAlign: 'center', fontSize: 10, marginTop: 2 }}>{p.code}</div>
                      <div style={{ textAlign: 'center', fontSize: 10 }}>{p.measurementUnit}</div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Button onClick={handlePrint} disabled={printing || Object.keys(selected).length === 0}>
        {printing ? "Enviando a impresora..." : "Imprimir etiquetas seleccionadas"}
      </Button>
      {message && <div className="mt-4 text-center font-semibold">{message}</div>}
    </div>
  );
}
