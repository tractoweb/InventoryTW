import { getStockData } from "@/actions/get-stock-data";
import { InventoryClient } from "./components/inventory-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { StockInfo } from "@/lib/types";

export default async function InventoryPage() {
  let items: StockInfo[] = [];
  let error: string | null = null;

  try {
    const result = await getStockData();
    if (result.error) {
      error = result.error;
    } else {
      items = result.data || [];
    }
  } catch (e: any) {
    error = e.message || 'Error al cargar el inventario.';
  }

  return (
    <div className="flex flex-col gap-8">
       <h1 className="text-3xl font-bold tracking-tight">Gestión de Stock por Almacén</h1>
        {error && (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error al Cargar el Inventario</AlertTitle>
                <AlertDescription>
                    {error}
                </AlertDescription>
            </Alert>
        )}
      <InventoryClient items={items} />
    </div>
  );
}
