import { inventoryItems } from "@/lib/data";
import { InventoryClient } from "./components/inventory-client";

export default function InventoryPage() {
  // In a real app, you would fetch this data from your database.
  const items = inventoryItems;

  return (
    <div className="flex flex-col gap-8">
       <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
      <InventoryClient items={items} />
    </div>
  );
}
