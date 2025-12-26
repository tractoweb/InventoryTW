import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InventoryItem } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Package } from "lucide-react";

export function RecentItems({ items }: { items: InventoryItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Añadidos Recientemente</CardTitle>
        <CardDescription>
          Un vistazo rápido a los artículos más nuevos en tu inventario.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} unidades añadidas
                </p>
              </div>
              <p className="text-right text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(item.dateAdded), {
                  addSuffix: true,
                  locale: es,
                })}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
