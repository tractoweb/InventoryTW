/**
 * Servicio de Inventario
 * Gestiona operaciones de productos, stocks y alertas
 */

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';

/**
 * Obtiene información completa de un producto
 */
export async function getProductDetails(productId: string): Promise<{
  success: boolean;
  product?: any;
  stocks?: any[];
  stockControls?: any[];
  error?: string;
}> {
  try {
    const product = await amplifyClient.models.Product.get({
      idProduct: Number(productId),
    } as any);

    if (!product.data) {
      return { success: false, error: 'Product not found' };
    }

    const productData = product.data as any;
    return {
      success: true,
      product: productData,
      stocks: productData.stocks,
      stockControls: productData.stockControls,
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Busca productos por nombre, código o barcode
 */
export async function searchProducts(
  query: string,
  limit: number = 50
): Promise<{
  success: boolean;
  products?: any[];
  error?: string;
}> {
  try {
    // Búsqueda por nombre o código
    const { data: products } = await amplifyClient.models.Product.list({
      filter: {
        or: [{ name: { contains: query } }, { code: { contains: query } }],
        isEnabled: { eq: true },
      },
    });

    if (products && products.length > 0) {
      return {
        success: true,
        products: products.slice(0, limit),
      };
    }

    // Si no encontró por nombre/código, buscar por barcode
    const { data: barcodes } = await amplifyClient.models.Barcode.list({
      filter: {
        value: { contains: query },
      },
    });

    if (barcodes && barcodes.length > 0) {
      const productIds = barcodes.map((b) => b.productId);
      // Amplify Data no soporta 'in', así que hacemos múltiples requests o filtramos en memoria
      const productsFromBarcodeArr = [];
      for (const id of productIds) {
        const { data: prod } = await amplifyClient.models.Product.get({ idProduct: Number(id) } as any);
        if (prod) productsFromBarcodeArr.push(prod);
      }

      return {
        success: true,
        products: productsFromBarcodeArr.slice(0, limit),
      };
    }

    return { success: true, products: [] };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Obtiene alertas de stock bajo
 */
export async function getLowStockAlerts(): Promise<{
  success: boolean;
  alerts?: {
    productId: string;
    productName: string;
    currentStock: number;
    warningQuantity: number;
    warehouseName: string;
  }[];
  error?: string;
}> {
  try {
    // Obtener todos los stock controls habilitados
    const { data: controls } = await amplifyClient.models.StockControl.list({
      filter: {
        isLowStockWarningEnabled: { eq: true },
      },
    });

    if (!controls || controls.length === 0) {
      return { success: true, alerts: [] };
    }

    const alerts: any[] = [];

    for (const control of controls) {
      // Obtener stocks del producto
      const { data: stocks } = await amplifyClient.models.Stock.list({
        filter: {
          productId: { eq: control.productId },
        },
      });

      const totalStock = stocks?.reduce((sum, s) => sum + (s.quantity || 0), 0) || 0;

      // Si stock es menor al mínimo, agregar alerta
      if (totalStock <= (control.lowStockWarningQuantity || 0)) {
        alerts.push({
          productId: control.productId,
          productName: control.product?.name || 'Unknown',
          currentStock: totalStock,
          warningQuantity: control.lowStockWarningQuantity,
          warehouseName: stocks?.[0]?.warehouse?.name || 'Unknown',
        });
      }
    }

    return { success: true, alerts };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Obtiene resumen de inventario por almacén
 */
export async function getInventorySummary(warehouseId?: string): Promise<{
  success: boolean;
  summary?: {
    totalProducts: number;
    totalUnits: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  error?: string;
}> {
  try {
    const normalizedWarehouseId = warehouseId === undefined ? undefined : Number(warehouseId);
    const stockFilter = normalizedWarehouseId ? { warehouseId: { eq: normalizedWarehouseId } } : undefined;
    const { data: stocks } = await amplifyClient.models.Stock.list({
      filter: stockFilter as any,
    });

    const { data: controls } = await amplifyClient.models.StockControl.list({
      filter: {
        isLowStockWarningEnabled: { eq: true },
      },
    });

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalUnits = 0;
    let totalValue = 0;

    stocks?.forEach((stock) => {
      totalUnits += stock.quantity || 0;

      const productRecord = (stock as any)?.product;
      const cost = typeof productRecord === 'object' && productRecord ? Number(productRecord.cost ?? 0) : 0;
      totalValue += (stock.quantity || 0) * cost;

      // Contar bajo stock
      const control = controls?.find((c) => c.productId === stock.productId);
      if (control && (stock.quantity || 0) <= (control.lowStockWarningQuantity || 0)) {
        lowStockCount++;
      }

      // Contar sin stock
      if (!stock.quantity || stock.quantity === 0) {
        outOfStockCount++;
      }
    });

    return {
      success: true,
      summary: {
        totalProducts: stocks?.length || 0,
        totalUnits,
        totalValue,
        lowStockCount,
        outOfStockCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Crea o actualiza un ajuste de stock
 */
export async function adjustStock(
  productId: string,
  warehouseId: string,
  newQuantity: number,
  reason: string,
  userId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const normalizedProductId = Number(productId);
    const normalizedWarehouseId = Number(warehouseId);
    const normalizedUserId = Number(userId);

    // Obtener stock actual
    const { data: stocks } = await amplifyClient.models.Stock.list({
      filter: {
        productId: { eq: normalizedProductId },
        warehouseId: { eq: normalizedWarehouseId },
      },
    });

    const stock = stocks?.[0];
    const currentQuantity = stock?.quantity || 0;
    const difference = newQuantity - currentQuantity;

    // Actualizar stock
    if (stock) {
      await amplifyClient.models.Stock.update({
        productId: (stock as any).productId,
        warehouseId: (stock as any).warehouseId,
        quantity: newQuantity,
      });
    } else {
      await amplifyClient.models.Stock.create({
        productId: normalizedProductId,
        warehouseId: normalizedWarehouseId,
        quantity: newQuantity,
      });
    }

    // Crear entrada en Kardex para auditoría
    const { createKardexEntry } = await import('./kardex-service');
    await createKardexEntry({
      productId: normalizedProductId,
      date: new Date(),
      type: 'AJUSTE',
      quantity: difference,
      balance: newQuantity,
      note: reason,
      userId: normalizedUserId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

// Export all inventory-related functions as inventoryService for compatibility
export const inventoryService = {
  getProductDetails,
  searchProducts,
  getLowStockAlerts,
  getInventorySummary,
  adjustStock,
};
