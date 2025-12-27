import { getStockData } from "@/actions/get-stock-data";
import { InventoryClient } from "./components/inventory-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

// This page now effectively shows all product definitions by pulling from the stock table.
// It can be considered the "Product Master" or general inventory view.

export default async function InventoryPage() {
  const { data: items, error } = await getStockData();

  // For this view, we might want to show unique products, not stock lines.
  // We can aggregate on the client, or change the query.
  // For now, passing all stock lines is fine.
  const uniqueItems = items ? Array.from(new Map(items.map(item => [item.id, item])).values()) : [];


  return (
    <div className="flex flex-col gap-8">
       <h1 className="text-3xl font-bold tracking-tight">Maestro de Productos</h1>
        {error && (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error al Cargar el Inventario</AlertTitle>
                <AlertDescription>
                    {error}
                </AlertDescription>
            </Alert>
        )}
      <InventoryClient items={items || []} pageType="inventory" />
    </div>
  );
}
