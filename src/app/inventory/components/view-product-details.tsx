"use client";

import { useEffect, useState } from "react";
import { getProductDetails } from "@/actions/get-product-details";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ViewProductDetailsProps = {
  productId: number | null;
};

export function ViewProductDetails({ productId }: ViewProductDetailsProps) {
  const [details, setDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                    {renderDetail("Impuestos Aplicados", details.taxes)}
                </div>
                    <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">Configuración</h3>
                    {renderDetail("Posición en Almacén", details.measurementunit)}
                    {renderBoolean("Habilitado", details.isenabled)}
                    {renderBoolean("Precio Incluye Impuestos", details.istaxinclusiveprice)}
                    {renderDetail("Códigos de Barras", details.barcodes)}
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
