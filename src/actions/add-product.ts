
'use server';

import { z } from 'zod';
import { getDbConnection } from '@/lib/db-connection';
import type { Connection } from 'mysql2/promise';

const AddProductSchema = z.object({
  name: z.string().min(2, "El nombre del producto es obligatorio."),
  code: z.string().optional(),
  barcode: z.string().optional(),
  measurementUnit: z.string().optional(),
  productGroupId: z.coerce.number().optional(),
  description: z.string().optional(),
  ageRestriction: z.coerce.number().optional(),
  isEnabled: z.boolean().default(true),
  isUsingDefaultQuantity: z.boolean().default(true),
  isService: z.boolean().default(false),
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo.").optional(),
  isTaxInclusivePrice: z.boolean().default(true),
  taxes: z.array(z.coerce.number()).optional(),
  reorderPoint: z.coerce.number().min(0).optional(),
  lowStockWarningQuantity: z.coerce.number().min(0).optional(),
  isLowStockWarningEnabled: z.boolean().default(true),
});

export type AddProductInput = z.infer<typeof AddProductSchema>;

/**
 * Crea un nuevo producto en la base de datos dentro de una transacción.
 * 1. Inserta en la tabla `product`.
 * 2. Si se provee, inserta en `barcode`.
 * 3. Si se proveen, inserta en `producttax`.
 * 4. Inserta la configuración de stock en `stockcontrol`.
 */
export async function addProduct(input: AddProductInput) {
  const validation = AddProductSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      error: "Datos de entrada inválidos.",
      details: validation.error.flatten().fieldErrors,
    };
  }

  const { name, code, barcode, taxes, reorderPoint, lowStockWarningQuantity, isLowStockWarningEnabled, ...rest } = validation.data;

  let connection: Connection | null = null;
  try {
    connection = await getDbConnection();
    await connection.beginTransaction();

    // 1. Insertar en la tabla Product
    const productQuery = `
      INSERT INTO Product (
        Name, Code, PLU, MeasurementUnit, Price, IsTaxInclusivePrice, CurrencyId,
        IsPriceChangeAllowed, IsService, IsUsingDefaultQuantity, IsEnabled,
        Description, Cost, Markup, AgeRestriction, LastPurchasePrice, \`Rank\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    // Nota: Algunos valores son hardcodeados/defaults por ahora.
    // CurrencyId=1 asumiendo que es la moneda por defecto (Peso Colombiano).
    const [productResult] = await connection.execute(productQuery, [
      name,
      code || null,
      null, // PLU
      rest.measurementUnit || null,
      rest.price,
      rest.isTaxInclusivePrice,
      1, // CurrencyId (Asumiendo 1 para COP)
      false, // IsPriceChangeAllowed
      rest.isService,
      rest.isUsingDefaultQuantity,
      rest.isEnabled,
      rest.description || null,
      rest.cost || 0,
      0, // Markup
      rest.ageRestriction || null,
      0, // LastPurchasePrice
      0  // Rank
    ]) as any[];

    const newProductId = productResult.insertId;

    // 2. Insertar en Barcode si existe
    if (barcode) {
      await connection.execute('INSERT INTO Barcode (ProductId, Value) VALUES (?, ?)', [newProductId, barcode]);
    }

    // 3. Insertar en ProductTax si hay impuestos
    if (taxes && taxes.length > 0) {
      const taxValues = taxes.map(taxId => [newProductId, taxId]);
      await connection.query('INSERT INTO ProductTax (ProductId, TaxId) VALUES ?', [taxValues]);
    }

    // 4. Insertar en StockControl
    const stockControlQuery = `
      INSERT INTO StockControl (
        ProductId, ReorderPoint, IsLowStockWarningEnabled, LowStockWarningQuantity
      ) VALUES (?, ?, ?, ?);
    `;
    await connection.execute(stockControlQuery, [
      newProductId,
      reorderPoint || 0,
      isLowStockWarningEnabled,
      lowStockWarningQuantity || 0
    ]);

    // Si todo fue bien, confirmar la transacción
    await connection.commit();

    return { success: true, message: `Producto "${name}" creado correctamente con ID: ${newProductId}.` };
  } catch (error: any) {
    // Si algo falló, revertir todos los cambios
    if (connection) {
      await connection.rollback();
    }
    console.error("Error al crear el producto:", error);
    return { success: false, error: error.message || "Error al conectar o ejecutar la consulta en la base de datos." };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
