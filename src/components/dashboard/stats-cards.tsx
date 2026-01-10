import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Package, Archive, Wallet, PackageCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Terminal } from "lucide-react";
import type { DashboardStats } from "@/actions/get-dashboard-stats";

type StatsCardsProps = {
    data: DashboardStats | null;
    error: string | null;
};

export function StatsCards({ data, error }: StatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (error) {
    return (
      <Alert variant="destructive" className="md:col-span-4">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error al cargar las estadísticas</AlertTitle>
        <AlertDescription>
          No se pudieron cargar las tarjetas de estadísticas. Error: {error}
        </AlertDescription>
      </Alert>
    );
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
    );
  }

  const {
    totalUnits,
    totalValue,
    lowStockCount,
    outOfStockCount,
    uniqueProductsCount,
  } = data;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Productos</CardTitle>
          <PackageCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{uniqueProductsCount}</div>
          <p className="text-xs text-muted-foreground">Productos únicos</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unidades</CardTitle>
          <Archive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUnits}</div>
          <p className="text-xs text-muted-foreground">Unidades en stock</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bajo Stock</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
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
          <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          <p className="text-xs text-muted-foreground">Valor estimado de todo el stock</p>
        </CardContent>
      </Card>
    </div>
  );
}
