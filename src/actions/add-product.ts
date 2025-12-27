
'use server';

import { z } from 'zod';
import { getDbConnection } from '@/lib/db-connection';
import type { Connection } from 'mysql2/promise';

const AddProductSchema = z.object({
  name: z.string().min(2, "El nombre del producto es obligatorio."),
  code: z.string().optional(),
  measurementUnit: z.string().min(1, "La posición es obligatoria."),
  productGroupId: z.coerce.number().min(1, "Debe seleccionar una categoría."),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  isUsingDefaultQuantity: z.boolean().default(true),
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo.").optional(),
  isTaxInclusivePrice: z.boolean().default(true),
  taxes: z.array(z.coerce.number()).optional(),
  reorderPoint: z.coerce.number().min(0).optional(),
  lowStockWarningQuantity: z.coerce.number().min(0).optional(),
  isLowStockWarningEnabled: z.boolean().default(true),
  initialQuantity: z.coerce.number().min(0).optional(),
  warehouseId: z.coerce.number().optional(),
}).refine(data => {
    if (data.initialQuantity && data.initialQuantity > 0) {
        return !!data.warehouseId;
    }
    return true;
}, {
    message: "Debe seleccionar un almacén si ingresa una cantidad inicial.",
    path: ["warehouseId"],
});


export type AddProductInput = z.infer<typeof AddProductSchema>;

/**
 * Crea un nuevo producto en la base de datos dentro de una transacción.
 * 1. Valida que el código no exista.
 * 2. Inserta en la tabla `product`.
 * 3. Si se provee, inserta el código como `barcode`.
 * 4. Si se proveen, inserta en `producttax`.
 * 5. Inserta la configuración de stock en `stockcontrol`.
 * 6. Si se provee, inserta el stock inicial en `stock`.
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

  const { name, code, productGroupId, taxes, reorderPoint, lowStockWarningQuantity, isLowStockWarningEnabled, initialQuantity, warehouseId, ...rest } = validation.data;

  let connection: Connection | null = null;
  try {
    connection = await getDbConnection();
    
    // 0. Validar que el código no exista antes de la transacción
    if (code) {
        const [existingProduct] = await connection.execute('SELECT id FROM product WHERE code = ?', [code]) as any[];
        if (existingProduct.length > 0) {
            return {
                success: false,
                error: `La referencia "${code}" ya está en uso por otro producto.`,
            };
        }
    }
    
    await connection.beginTransaction();

    // 1. Insertar en la tabla product
    const productQuery = `
      INSERT INTO product (
        ProductGroupId, Name, Code, MeasurementUnit, Price, IsTaxInclusivePrice, CurrencyId,
        IsPriceChangeAllowed, IsService, IsUsingDefaultQuantity, IsEnabled,
        Description, Cost, Markup, AgeRestriction, LastPurchasePrice, \`Rank\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const [productResult] = await connection.execute(productQuery, [
      productGroupId || null,
      name,
      code || null,
      rest.measurementUnit || null,
      rest.price,
      rest.isTaxInclusivePrice,
      1, // CurrencyId (Asumiendo 1)
      false, // IsPriceChangeAllowed
      false, // IsService
      rest.isUsingDefaultQuantity,
      rest.isEnabled,
      rest.description || null,
      rest.cost || 0,
      0, // Markup
      null, // AgeRestriction
      rest.cost || 0, // LastPurchasePrice se setea con el costo inicial
      0  // Rank
    ]) as any[];

    const newProductId = productResult.insertId;

    // 2. Insertar en barcode si existe un código
    if (code) {
      await connection.execute('INSERT INTO barcode (ProductId, Value) VALUES (?, ?)', [newProductId, code]);
    }

    // 3. Insertar en producttax si hay impuestos
    if (taxes && taxes.length > 0) {
      const taxValues = taxes.map(taxId => [newProductId, taxId]);
      await connection.query('INSERT INTO producttax (ProductId, TaxId) VALUES ?', [taxValues]);
    }

    // 4. Insertar en stockcontrol
    const stockControlQuery = `
      INSERT INTO stockcontrol (
        ProductId, ReorderPoint, IsLowStockWarningEnabled, LowStockWarningQuantity
      ) VALUES (?, ?, ?, ?);
    `;
    await connection.execute(stockControlQuery, [
      newProductId,
      reorderPoint || 0,
      isLowStockWarningEnabled,
      lowStockWarningQuantity || 0
    ]);
    
    // 5. Insertar stock inicial si se proporcionó
    if (initialQuantity && initialQuantity > 0 && warehouseId) {
        const stockQuery = `
            INSERT INTO stock (ProductId, WarehouseId, Quantity) VALUES (?, ?, ?);
        `;
        await connection.execute(stockQuery, [newProductId, warehouseId, initialQuantity]);
    }


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
