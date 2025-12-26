import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { getProductInventory } from "@/actions/get-product-inventory";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Package, Terminal } from "lucide-react";

export async function RecentItems() {
  const { data: items, error } = await getProductInventory();

  if (error) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Añadidos Recientemente</CardTitle>
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

  const recentItems = items?.slice(0, 5) || [];

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
                    Stock total: {item.totalstock ?? 0}
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
