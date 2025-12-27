import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Boxes, Package, PackageCheck, Archive, Wallet } from "lucide-react";
import { getDashboardStats } from "@/actions/get-dashboard-stats";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Terminal } from "lucide-react";

export async function StatsCards() {
  const { data, error } = await getDashboardStats();

  if (error) {
    return (
        <Alert variant="destructive" className="md:col-span-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error al cargar las estadísticas</AlertTitle>
            <AlertDescription>
                No se pudieron cargar las tarjetas de estadísticas. Error: {error}
            </AlertDescription>
        </Alert>
    )
  }

  if (!data) {
    return (
        <Alert className="md:col-span-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>No hay datos</AlertTitle>
            <AlertDescription>
                Aún no hay productos en el inventario para mostrar estadísticas.
            </AlertDescription>
        </Alert>
    )
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount);
  };

  const {
    totalUnits,
    inventoryValue,
    lowStockCount,
    outOfStockCount,
    uniqueProductsCount,
  } = data;


  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Unidades</CardTitle>
          <PackageCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">en {uniqueProductsCount} productos únicos</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
          <Archive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{lowStockCount}</div>
          <p className="text-xs text-muted-foreground">Productos que necesitan atención</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Agotados</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{outOfStockCount}</div>
          <p className="text-xs text-muted-foreground">Productos para reponer</p>
        </CardContent>
      </Card>
       <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Valor del Inventario</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(inventoryValue)}</div>
          <p className="text-xs text-muted-foreground">Valor estimado de todo el stock</p>
        </CardContent>
      </Card>
    </div>
  );
}
