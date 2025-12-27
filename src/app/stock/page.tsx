import { getStockData } from "@/actions/get-stock-data";
import { InventoryClient } from "../inventory/components/inventory-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default async function StockPage() {
  const { data: items, error } = await getStockData();

  return (
    <div className="flex flex-col gap-8">
       <h1 className="text-3xl font-bold tracking-tight">Gestión de Stock por Almacén</h1>
        {error && (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error al Cargar el Stock</AlertTitle>
                <AlertDescription>
                    {error}
                </AlertDescription>
            </Alert>
        )}
      <InventoryClient items={items || []} pageType="stock" />
    </div>
  );
}
