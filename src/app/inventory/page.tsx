import { getStockData } from "@/actions/get-stock-data";
import { getProductGroups, ProductGroup } from "@/actions/get-product-groups";
import { InventoryClient } from "./components/inventory-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { getWarehouses, Warehouse } from "@/actions/get-warehouses";

export default async function InventoryPage() {
  const { data: items, error: itemsError } = await getStockData();
  const { data: productGroups, error: groupsError } = await getProductGroups();
  const { data: warehouses, error: warehousesError } = await getWarehouses();
  
  const error = itemsError || groupsError || warehousesError;

  return (
    <div className="flex flex-col gap-8">
       <h1 className="text-3xl font-bold tracking-tight">Maestro de Productos</h1>
        {error && (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error al Cargar Datos</AlertTitle>
                <AlertDescription>
                    {error}
                </AlertDescription>
            </Alert>
        )}
      <InventoryClient 
        items={items || []} 
        productGroups={productGroups || []} 
        warehouses={warehouses || []}
        pageType="inventory" 
      />
    </div>
  );
}
