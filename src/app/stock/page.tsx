import { getStockData } from "@/actions/get-stock-data";
import { InventoryClient } from "../inventory/components/inventory-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { getWarehouses } from "@/actions/get-warehouses";
import { getProductGroups } from "@/actions/get-product-groups";

export default async function StockPage() {
  const { data: items, error: itemsError } = await getStockData();
  const { data: warehouses, error: warehousesError } = await getWarehouses();
  const { data: productGroups, error: groupsError } = await getProductGroups();

  const error = itemsError || warehousesError || groupsError;

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
      <InventoryClient 
        items={items || []} 
        warehouses={warehouses || []}
        productGroups={productGroups || []}
        pageType="stock" 
      />
    </div>
  );
}
