
import { inventoryService } from '@/services/inventory-service';
import { unstable_noStore as noStore } from 'next/cache';

export type DashboardStats = {
  totalUnits: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  uniqueProductsCount: number;
};

export async function getDashboardStats() {
  noStore();
  try {
    // Use the inventory service to get summary stats
    const summaryResult = await inventoryService.getInventorySummary();
    const alertsResult = await inventoryService.getLowStockAlerts();


    const summary: Partial<DashboardStats & { outOfStockCount?: number; totalProducts?: number }> = summaryResult.summary || {};
    const alerts = alertsResult.alerts || [];

    const data: DashboardStats = {
      totalUnits: summary.totalUnits || 0,
      totalValue: summary.totalValue || 0,
      lowStockCount: alerts.length || 0,
      outOfStockCount: summary.outOfStockCount || 0,
      uniqueProductsCount: summary.totalProducts || 0,
    };

    return { data };
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return { error: error.message || 'Error fetching stats from the database.' };
  }
}
