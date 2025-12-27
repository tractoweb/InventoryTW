
'use server';

import { queryDatabase } from '@/lib/db-connection';
import { unstable_noStore as noStore } from 'next/cache';

export type DashboardStats = {
  totalUnits: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  uniqueProductsCount: number;
};

export async function getDashboardStats() {
  noStore();
  try {
    // Definimos el umbral de stock bajo. Usaremos la tabla stockcontrol si existe, si no, un valor fijo.
    // Esta consulta es más compleja, la haremos por separado.
    const lowStockQuery = `
        SELECT COUNT(DISTINCT s.productid) as count
        FROM stock s
        JOIN stockcontrol sc ON s.productid = sc.productid
        WHERE s.quantity <= sc.lowstockwarningquantity AND sc.islowstockwarningenabled = 1;
    `;

    const mainStatsQuery = `
      SELECT 
        SUM(s.quantity) AS totalUnits,
        SUM(s.quantity * p.cost) AS inventoryValue,
        (SELECT COUNT(DISTINCT productid) FROM stock WHERE quantity = 0) as outOfStockCount,
        COUNT(DISTINCT s.productid) as uniqueProductsCount
      FROM stock s
      JOIN product p ON s.productid = p.id;
    `;

    const [mainStatsResult] = await queryDatabase(mainStatsQuery) as any[];
    const [lowStockResult] = await queryDatabase(lowStockQuery) as any[];

    const data: DashboardStats = {
      totalUnits: Number(mainStatsResult.totalUnits) || 0,
      inventoryValue: Number(mainStatsResult.inventoryValue) || 0,
      lowStockCount: Number(lowStockResult.count) || 0,
      outOfStockCount: Number(mainStatsResult.outOfStockCount) || 0,
      uniqueProductsCount: Number(mainStatsResult.uniqueProductsCount) || 0,
    };

    return { data };
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return { error: error.message || 'Error fetching stats from the database.' };
  }
}
