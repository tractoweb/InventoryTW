import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InventoryItem } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { Package } from "lucide-react";

export function RecentItems({ items }: { items: InventoryItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recently Added</CardTitle>
        <CardDescription>
          A quick look at the newest items in your inventory.
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
                  {item.quantity} units added
                </p>
              </div>
              <p className="text-right text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(item.dateAdded), {
                  addSuffix: true,
                })}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
