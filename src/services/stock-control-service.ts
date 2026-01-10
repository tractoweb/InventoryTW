import { amplifyClient } from "@/lib/amplify-config";

export async function listStockControls() {
  return amplifyClient.models.StockControl.list();
}

export async function createStockControl(stockControl: any) {
  return amplifyClient.models.StockControl.create(stockControl);
}
