import { amplifyClient } from "@/lib/amplify-server";
import { listAllPages } from "@/services/amplify-list-all";

export async function listStockControls() {
  return listAllPages(amplifyClient.models.StockControl.list);
}

export type StockControlCreateInput = {
  stockControlId: number;
  productId: number;
  customerId?: number | null;
  reorderPoint?: number;
  preferredQuantity?: number;
  isLowStockWarningEnabled?: boolean;
  lowStockWarningQuantity?: number;
};

export async function createStockControl(stockControl: StockControlCreateInput) {
  return amplifyClient.models.StockControl.create({
    stockControlId: stockControl.stockControlId,
    productId: stockControl.productId,
    customerId: stockControl.customerId ?? undefined,
    reorderPoint: stockControl.reorderPoint ?? 0,
    preferredQuantity: stockControl.preferredQuantity ?? 0,
    isLowStockWarningEnabled: stockControl.isLowStockWarningEnabled ?? true,
    lowStockWarningQuantity: stockControl.lowStockWarningQuantity ?? 0,
  });
}
