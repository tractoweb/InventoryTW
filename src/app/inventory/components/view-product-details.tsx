"use client";

import { useEffect, useState } from "react";
import { getProductDetails } from "@/actions/get-product-details";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Terminal } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

type ViewProductDetailsProps = {
  productId: number | null;
};

export function ViewProductDetails({ productId }: ViewProductDetailsProps) {
  const [details, setDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
    const [pdfPreviewDocumentId, setPdfPreviewDocumentId] = useState<number | null>(null);

  useEffect(() => {
    if (productId) {
      const fetchDetails = async () => {
        setIsLoading(true);
        setError(null);
        const result = await getProductDetails(productId);
        if (result.error) {
          setError(result.error);
        } else {
          setDetails(result.data);
        }
        setIsLoading(false);
      };
      fetchDetails();
    }
  }, [productId]);
  
  const formatCurrency = (amount: number | null | undefined, currencyCode: string | null | undefined) => {
      if (amount === null || amount === undefined || isNaN(amount)) {
          return "N/A";
      }
      return new Intl.NumberFormat("es-CO", { style: "currency", currency: currencyCode || 'COP', minimumFractionDigits: 0 }).format(amount);
  }

  const renderDetail = (label: string, value: any) => {
    const displayValue = value === null || value === undefined || value === '' ? 'N/A' : String(value);
    return (
        <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="font-medium text-muted-foreground">{label}:</p>
            <div className="break-words">{displayValue}</div>
        </div>
    );
  };
  
  const renderBoolean = (label: string, value: any) => {
    const displayValue = value ? 'Sí' : 'No';
    return (
        <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="font-medium text-muted-foreground">{label}:</p>
            <div className="break-words">
                <Badge variant={value ? 'default' : 'secondary'}>{displayValue}</Badge>
            </div>
        </div>
    );
  }

  const renderDate = (label: string, dateString: string | null | undefined) => {
    let displayValue = 'N/A';
    if (dateString) {
        try {
            displayValue = format(new Date(dateString), "d MMM, yyyy HH:mm:ss", { locale: es });
        } catch (e) {
            displayValue = "Fecha inválida";
        }
    }
    return renderDetail(label, displayValue);
  }

  return (
    <div className="py-4 space-y-6">
        <Dialog open={pdfPreviewDocumentId !== null} onOpenChange={(open) => !open && setPdfPreviewDocumentId(null)}>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>
                        {pdfPreviewDocumentId ? `Documento #${pdfPreviewDocumentId} (PDF)` : "Vista previa PDF"}
                    </DialogTitle>
                </DialogHeader>
                {pdfPreviewDocumentId ? (
                    <iframe
                        title={`PDF Documento ${pdfPreviewDocumentId}`}
                        src={`/documents/${pdfPreviewDocumentId}/pdf/file`}
                        className="h-[80vh] w-full rounded border"
                    />
                ) : null}
            </DialogContent>
        </Dialog>

        {isLoading && (
            <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/2" />
            </div>
        )}
        {error && !isLoading && (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error al Cargar Detalles</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        {details && !isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">Información General</h3>
                    {renderDetail("ID", details.id)}
                    {renderDetail("Nombre", details.name)}
                    {renderDetail("Código", details.code)}
                    {renderDetail("Descripción", details.description)}
                    {renderDetail("Categoría (Grupo)", details.productgroupname)}
                    {renderDetail("Color", details.color)}
                </div>
                <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">Precio y Costo</h3>
                    {renderDetail("Precio", formatCurrency(details.price, details.currencycode))}
                    {renderDetail("Costo", formatCurrency(details.cost, details.currencycode))}
                    {renderDetail("Margen (Markup)", `${details.markup}%`)}
                    {renderDetail("Último Precio Compra", formatCurrency(details.lastpurchaseprice, details.currencycode))}
                    {renderDetail("Moneda", `${details.currencyname || 'N/A'} (${details.currencycode || 'N/A'})`)}
                    {renderDetail(
                      "Impuestos Aplicados",
                      details.taxesText ?? (Array.isArray(details.taxes) ? details.taxes.map((t: any) => t?.name).filter(Boolean).join(', ') : details.taxes)
                    )}
                </div>
                    <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">Configuración</h3>
                    {renderDetail("Posición en Almacén", details.measurementunit)}
                    {renderBoolean("Habilitado", details.isenabled)}
                    {renderBoolean("Precio Incluye Impuestos", details.istaxinclusiveprice)}
                    {renderDetail(
                      "Códigos de Barras",
                      details.barcodesText ?? (Array.isArray(details.barcodes) ? details.barcodes.map((b: any) => b?.value ?? b).filter(Boolean).join(', ') : details.barcodes)
                    )}
                </div>
                <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">Inventario</h3>
                        {renderDetail("Stock Total", details.totalstock)}
                        <div className="space-y-2 pt-2">
                            <p className="font-medium text-muted-foreground text-sm">Ubicaciones de Stock:</p>
                            {details.stocklocations && details.stocklocations.length > 0 ? (
                                <ul className="list-disc pl-5 text-sm space-y-1">
                                    {details.stocklocations.map((loc: any, index: number) => (
                                        <li key={index}><strong>{loc.quantity}</strong> en {loc.warehousename}</li>
                                    ))}
                                </ul>
                            ) : <p className="text-sm">Sin ubicaciones de stock registradas.</p>}
                        </div>
                </div>

                <div className="space-y-3 md:col-span-2">
                    <h3 className="font-semibold text-lg border-b pb-2">Stock Control</h3>
                    {Array.isArray(details.stockControls) && details.stockControls.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {details.stockControls.map((sc: any) => (
                                <div key={String(sc.stockControlId)} className="rounded-lg border p-4">
                                    <div className="text-sm font-medium">
                                        {sc.customerName ? `Cliente: ${sc.customerName}` : "General"}
                                    </div>
                                    <div className="mt-2 space-y-2">
                                        {renderDetail("Reorder Point", sc.reorderPoint)}
                                        {renderDetail("Preferred Qty", sc.preferredQuantity)}
                                        {renderBoolean("Low Stock Warning", sc.isLowStockWarningEnabled)}
                                        {renderDetail("Warning Qty", sc.lowStockWarningQuantity)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Sin reglas de stock control.</p>
                    )}
                </div>

                <div className="space-y-3 md:col-span-2">
                    <h3 className="font-semibold text-lg border-b pb-2">Documentos relacionados</h3>
                    {Array.isArray(details.relatedDocuments) && details.relatedDocuments.length > 0 ? (
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {details.relatedDocuments.slice(0, 15).map((d: any) => (
                                <li key={String(d.documentId)}>
                                    <span className="font-medium">{d.number ? `${d.number}` : `Documento #${d.documentId}`}</span>
                                    <span className="ml-2 text-muted-foreground">
                                        <button
                                            type="button"
                                            className="underline"
                                            onClick={() => setPdfPreviewDocumentId(Number(d.documentId))}
                                        >
                                            Ver PDF
                                        </button>
                                        <span className="mx-2">·</span>
                                        <Link className="underline" href={`/documents?documentId=${d.documentId}`}>
                                            Ver documento
                                        </Link>
                                    </span>
                                    {d.stockDate ? ` — ${d.stockDate}` : d.createdAt ? ` — ${d.createdAt}` : ""}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">Sin documentos asociados (o no cargados).</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Nota: se muestran los documentos más recientes (máx. 15).
                    </p>
                </div>
                    <div className="space-y-3 md:col-span-2">
                    <h3 className="font-semibold text-lg border-b pb-2">Fechas</h3>
                    {renderDate("Fecha de Creación", details.datecreated)}
                    {renderDate("Última Actualización", details.dateupdated)}
                </div>
                    <div className="space-y-3 md:col-span-2">
                    <h3 className="font-semibold text-lg border-b pb-2">Datos Binarios</h3>
                    {renderDetail("Imagen", details.image)}
                </div>
            </div>
        )}
    </div>
  );
}
