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

    const formatPercent = (value: number | null | undefined) => {
        const n = Number(value ?? 0);
        if (!Number.isFinite(n)) return '0%';
        return `${n.toFixed(1)}%`;
    };

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
                                        <h3 className="font-semibold text-lg border-b pb-2">Historial de liquidación (por documento)</h3>
                                        {details.pricingSummary && typeof details.pricingSummary.productPriceMatchesLatestDocument === 'boolean' ? (
                                            <p className="text-sm text-muted-foreground">
                                                Precio actual {details.pricingSummary.productPriceMatchesLatestDocument ? 'coincide' : 'no coincide'} con el último precio estimado por documento.
                                            </p>
                                        ) : null}

                                        {Array.isArray(details.pricingHistory) && details.pricingHistory.length > 0 ? (
                                            <div className="w-full overflow-auto rounded-md border">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">Documento</th>
                                                            <th className="px-3 py-2 text-left">Fecha</th>
                                                            <th className="px-3 py-2 text-right">Cant.</th>
                                                            <th className="px-3 py-2 text-right">Desc.</th>
                                                            <th className="px-3 py-2 text-right">IVA %</th>
                                                            <th className="px-3 py-2 text-right">IVA</th>
                                                            <th className="px-3 py-2 text-right">Flete</th>
                                                            <th className="px-3 py-2 text-right">Costo final</th>
                                                            <th className="px-3 py-2 text-right">Margen</th>
                                                            <th className="px-3 py-2 text-right">Venta est.</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {details.pricingHistory.slice(0, 20).map((h: any, idx: number) => (
                                                            <tr key={`${h.documentId}-${idx}`} className="border-t">
                                                                <td className="px-3 py-2">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium">
                                                                            {h.documentNumber ? String(h.documentNumber) : `Documento #${h.documentId}`}
                                                                        </span>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {h.freightName
                                                                                ? `Flete: ${h.freightName}${Number(h.freightCost ?? 0) ? ` (${formatCurrency(Number(h.freightCost ?? 0), details.currencycode)})` : ''}`
                                                                                : 'Flete: N/A'}
                                                                            <span className="mx-2">·</span>
                                                                            <button
                                                                                type="button"
                                                                                className="underline"
                                                                                onClick={() => setPdfPreviewDocumentId(Number(h.documentId))}
                                                                            >
                                                                                Ver PDF
                                                                            </button>
                                                                            <span className="mx-2">·</span>
                                                                            <Link className="underline" href={`/documents?documentId=${h.documentId}`}>
                                                                                Ver documento
                                                                            </Link>
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2">{h.date ? String(h.date) : 'N/A'}</td>
                                                                <td className="px-3 py-2 text-right">{Number(h.quantity ?? 0) || 0}</td>
                                                                <td className="px-3 py-2 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span>{formatPercent(h.discountPercentage)}</span>
                                                                        <span className="text-xs text-muted-foreground">{formatCurrency(h.unitDiscount, details.currencycode)}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right">{formatPercent(Number(h.ivaPercentage ?? 0) || 0)}</td>
                                                                <td className="px-3 py-2 text-right">{formatCurrency(h.unitIVA, details.currencycode)}</td>
                                                                <td className="px-3 py-2 text-right">{formatCurrency(h.unitFreight, details.currencycode)}</td>
                                                                <td className="px-3 py-2 text-right">{formatCurrency(h.unitFinalCost, details.currencycode)}</td>
                                                                <td className="px-3 py-2 text-right">{formatPercent(h.marginPercentage)}</td>
                                                                <td className="px-3 py-2 text-right">{formatCurrency(h.unitSalePrice, details.currencycode)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                Sin historial de liquidación. (Solo aparece si el documento guardó el snapshot de liquidación en la nota interna.)
                                            </p>
                                        )}

                                        <p className="text-xs text-muted-foreground">Nota: se muestran hasta 20 registros recientes.</p>
                                </div>

                                <div className="space-y-3 md:col-span-2">
                                    <h3 className="font-semibold text-lg border-b pb-2">Historial (document items recientes)</h3>
                                    {(() => {
                                        const items = Array.isArray(details.recentDocumentItems) ? details.recentDocumentItems : [];
                                        const docs = Array.isArray(details.relatedDocuments) ? details.relatedDocuments : [];
                                        const docById = new Map<number, any>(docs.map((d: any) => [Number(d.documentId), d] as const));

                                        if (items.length === 0) {
                                            return (
                                                <p className="text-sm text-muted-foreground">
                                                    Sin historial reciente en DocumentItems para este producto.
                                                </p>
                                            );
                                        }

                                        return (
                                            <div className="w-full overflow-auto rounded-md border">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">Documento</th>
                                                            <th className="px-3 py-2 text-left">Fecha</th>
                                                            <th className="px-3 py-2 text-right">Cant.</th>
                                                            <th className="px-3 py-2 text-right">Costo (guardado)</th>
                                                            <th className="px-3 py-2 text-right">Precio (guardado)</th>
                                                            <th className="px-3 py-2 text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {items.slice(0, 20).map((it: any) => {
                                                            const did = Number(it.documentId ?? 0);
                                                            const d = docById.get(did);
                                                            const docLabel = d?.number ? String(d.number) : `Documento #${did}`;
                                                            const docDate = d?.stockDate ? String(d.stockDate) : d?.createdAt ? String(d.createdAt) : it.createdAt ? String(it.createdAt) : 'N/A';
                                                            const qty = Number(it.quantity ?? 0) || 0;
                                                            const unitCost = it.productCost !== null && it.productCost !== undefined ? Number(it.productCost) : null;
                                                            const unitPrice = it.price !== null && it.price !== undefined ? Number(it.price) : null;
                                                            const total = it.total !== null && it.total !== undefined ? Number(it.total) : null;

                                                            return (
                                                                <tr key={String(it.documentItemId)} className="border-t">
                                                                    <td className="px-3 py-2">
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium">{docLabel}</span>
                                                                            <span className="text-xs text-muted-foreground">
                                                                                <Link className="underline" href={`/documents?documentId=${did}`}>Ver documento</Link>
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2">{docDate}</td>
                                                                    <td className="px-3 py-2 text-right">{qty}</td>
                                                                    <td className="px-3 py-2 text-right">{formatCurrency(unitCost ?? 0, details.currencycode)}</td>
                                                                    <td className="px-3 py-2 text-right">{formatCurrency(unitPrice ?? 0, details.currencycode)}</td>
                                                                    <td className="px-3 py-2 text-right">{formatCurrency(total ?? 0, details.currencycode)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })()}
                                    <p className="text-xs text-muted-foreground">
                                        Nota: esta tabla usa valores guardados en DocumentItem (útil para documentos antiguos sin snapshot de liquidación).
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
