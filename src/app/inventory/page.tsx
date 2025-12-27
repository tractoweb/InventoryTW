import { getStockData } from "@/actions/get-stock-data";
import { InventoryClient } from "./components/inventory-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { StockInfo } from "@/lib/types";

// Revalidate the data for this page every hour.
export const revalidate = 3600;

export default async function InventoryPage() {
  const { data: items, error } = await getStockData();

  return (
    <div className="flex flex-col gap-8">
       <h1 className="text-3xl font-bold tracking-tight">Gestión de Inventario</h1>
        {error && (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error al Cargar el Inventario</AlertTitle>
                <AlertDescription>
                    {error}
                </AlertDescription>
            </Alert>
        )}
      <InventoryClient items={items || []} />
    </div>
  );
}
