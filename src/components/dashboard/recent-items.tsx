import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { getStockData } from "@/actions/get-stock-data";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Package, Terminal } from "lucide-react";
import type { StockInfo } from "@/lib/types";

export async function RecentItems() {
  const { data: items, error } = await getStockData();

  if (error) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Actualizados Recientemente</CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
  }

  // Sort by dateupdated and take the top 5
  const recentItems = items
    ?.sort((a, b) => new Date(b.dateupdated).getTime() - new Date(a.dateupdated).getTime())
    .slice(0, 5) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actualizados Recientemente</CardTitle>
        <CardDescription>
          Un vistazo rápido a los últimos productos actualizados en tu inventario.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentItems.length > 0 ? (
          <div className="space-y-6">
            {recentItems.map((item) => (
              <div key={item.id} className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Stock: {item.quantity ?? 0} en {item.warehousename}
                  </p>
                </div>
                <p className="text-right text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(item.dateupdated), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </div>
            ))}
          </div>
        ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No hay productos para mostrar.</p>
        )}
      </CardContent>
    </Card>
  );
}
