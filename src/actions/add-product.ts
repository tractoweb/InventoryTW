'use server';

import { z } from 'zod';

// Basado en la estructura de la BD, este schema es más complejo
const AddProductSchema = z.object({
  // Details Tab
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

  // Price & Tax Tab
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo."),
  isTaxInclusivePrice: z.boolean().default(true),
  taxes: z.array(z.coerce.number()).optional(), // Array de Tax IDs

  // Stock Control Tab
  reorderPoint: z.coerce.number().optional(),
  lowStockWarningQuantity: z.coerce.number().optional(),
  isLowStockWarningEnabled: z.boolean().default(true),
});

export type AddProductInput = z.infer<typeof AddProductSchema>;

/**
 * Simula la creación de un nuevo producto en la base de datos.
 * En una implementación real, esto ejecutaría múltiples consultas SQL dentro de una transacción:
 * 1. INSERT INTO product (...) VALUES (...) -> obtener el nuevo productId
 * 2. Si hay barcode: INSERT INTO barcode (productid, value) VALUES (productId, ?)
 * 3. Si hay taxes: INSERT INTO producttax (productid, taxid) VALUES (productId, ?), (productId, ?)...
 * 4. INSERT INTO stockcontrol (...) VALUES (productId, ...)
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

  const { name, code, barcode, taxes, ...rest } = validation.data;

  console.log(`Simulando creación de producto: ${name}`);
  console.log('Valores recibidos:', validation.data);

  // Aquí iría la lógica para interactuar con la base de datos.
  // Por ahora, siempre devolvemos éxito para la demo.
  try {
    // EJEMPLO DE TRANSACCIÓN (pseudo-código):
    // const connection = await getDbConnection();
    // await connection.beginTransaction();
    // const [productResult] = await connection.execute('INSERT INTO product ...', [rest.fields]);
    // const newProductId = productResult.insertId;
    // if (barcode) await connection.execute('INSERT INTO barcode ...', [newProductId, barcode]);
    // if (taxes && taxes.length > 0) { ... }
    // await connection.execute('INSERT INTO stockcontrol ...', [newProductId, ...]);
    // await connection.commit();

    return { success: true, message: `Producto "${name}" creado correctamente (simulado).` };
  } catch (error: any) {
    console.error("Error al crear el producto:", error);
    // await connection.rollback();
    return { success: false, error: error.message || "Error al conectar con la base de datos." };
  }
}
