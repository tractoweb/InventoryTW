import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { inventoryItems } from "@/lib/data";
import { Boxes, Package, PackageCheck, Archive } from "lucide-react";

export function StatsCards() {
  const totalItems = inventoryItems.reduce((acc, item) => acc + item.quantity, 0);
  const lowStockItems = inventoryItems.filter(
    (item) => item.status === "Low Stock"
  ).length;
  const outOfStockItems = inventoryItems.filter(
    (item) => item.status === "Out of Stock"
  ).length;
  const categories = new Set(inventoryItems.map((item) => item.category)).size;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          <PackageCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalItems.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">in {inventoryItems.length} unique products</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
          <Archive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{lowStockItems}</div>
          <p className="text-xs text-muted-foreground">Items needing attention</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{outOfStockItems}</div>
          <p className="text-xs text-muted-foreground">Items to re-order</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Categories</CardTitle>
          <Boxes className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{categories}</div>
          <p className="text-xs text-muted-foreground">Product categories managed</p>
        </CardContent>
      </Card>
    </div>
  );
}
