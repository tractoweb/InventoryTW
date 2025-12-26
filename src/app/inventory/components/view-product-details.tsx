"use client";

import { useEffect, useState } from "react";
import { getProductDetails } from "@/actions/get-product-details";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

type ViewProductDetailsProps = {
  productId: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
};

export function ViewProductDetails({ productId, isOpen, setOpen }: ViewProductDetailsProps) {
  const [details, setDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, productId]);

  const renderDetail = (label: string, value: any) => {
    const displayValue = value === null || value === undefined || value === '' ? 'N/A' : String(value);
    return (
        <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="font-medium text-muted-foreground">{label}:</p>
            <p className="break-words">{displayValue}</p>
        </div>
    );
  };
  
  const renderBoolean = (label: string, value: any) => {
    const displayValue = value ? 'Sí' : 'No';
    return (
        <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="font-medium text-muted-foreground">{label}:</p>
            <p className="break-words">
                <Badge variant={value ? 'default' : 'secondary'}>{displayValue}</Badge>
            </p>
        </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles del Producto</DialogTitle>
          <DialogDescription>
            Información completa del producto seleccionado.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
            {isLoading && (
                <div className="space-y-4">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            )}
            {error && (
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
                        {renderDetail("PLU", details.plu)}
                        {renderDetail("Descripción", details.description)}
                        {renderDetail("Grupo (Categoría)", details.productgroupname)}
                        {renderDetail("Color", details.color)}
                        {renderDetail("Restricción de Edad", details.agerestriction)}
                        {renderDetail("Ranking", details.rank)}
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-semibold text-lg border-b pb-2">Precio y Costo</h3>
                        {renderDetail("Precio", new Intl.NumberFormat("es-ES", { style: "currency", currency: details.currencycode || 'EUR' }).format(details.price))}
                        {renderDetail("Costo", new Intl.NumberFormat("es-ES", { style: "currency", currency: details.currencycode || 'EUR' }).format(details.cost))}
                        {renderDetail("Margen (Markup)", `${details.markup}%`)}
                        {renderDetail("Último Precio Compra", new Intl.NumberFormat("es-ES", { style: "currency", currency: details.currencycode || 'EUR' }).format(details.lastpurchaseprice))}
                        {renderDetail("Moneda", `${details.currencyname} (${details.currencycode})`)}
                        {renderDetail("Impuestos Aplicados", details.taxes)}
                    </div>
                     <div className="space-y-3">
                        <h3 className="font-semibold text-lg border-b pb-2">Configuración</h3>
                        {renderDetail("Unidad de Medida", details.measurementunit)}
                        {renderBoolean("Habilitado", details.isenabled)}
                        {renderBoolean("Es un Servicio", details.isservice)}
                        {renderBoolean("Precio Incluye Impuestos", details.istaxinclusiveprice)}
                        {renderBoolean("Permitir cambio de precio", details.ispricechangeallowed)}
                        {renderBoolean("Usa cantidad por defecto", details.isusingdefaultquantity)}
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
                        {renderDetail("Fecha de Creación", new Date(details.datecreated).toLocaleString('es-ES'))}
                        {renderDetail("Última Actualización", new Date(details.dateupdated).toLocaleString('es-ES'))}
                    </div>
                     <div className="space-y-3 md:col-span-2">
                        <h3 className="font-semibold text-lg border-b pb-2">Datos Binarios</h3>
                        {renderDetail("Imagen", details.image)}
                    </div>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
