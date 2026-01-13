import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Package, Terminal } from "lucide-react";
import type { StockInfo } from "@/lib/types";

type RecentItemsProps = {
  items: StockInfo[] | null;
  error: string | null;
};

export function RecentItems({ items, error }: RecentItemsProps) {
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
  const recentItems = (items ?? [])
    .slice()
    .sort((a, b) => {
      const aTime = a.dateupdated ? new Date(a.dateupdated).getTime() : 0;
      const bTime = b.dateupdated ? new Date(b.dateupdated).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actualizados Recientemente</CardTitle>
        <CardDescription>
          Un vistazo rápido a los últimos productos actualizados en tu
          inventario.
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
                    Stock: {item.quantity ?? 0}
                  </p>
                </div>
                {/* Sin fecha de actualización disponible */}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay productos para mostrar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
