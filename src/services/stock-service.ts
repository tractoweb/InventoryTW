import { amplifyClient } from "@/lib/amplify-config";

export async function listStocks() {
  return amplifyClient.models.Stock.list();
}

export async function createStock(stock: any) {
  return amplifyClient.models.Stock.create(stock);
}
