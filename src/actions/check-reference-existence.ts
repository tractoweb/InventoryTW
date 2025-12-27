
'use server';

import { getDbConnection } from '@/lib/db-connection';

/**
 * Verifica si un código de referencia de producto ya existe en la base de datos.
 * @param code La referencia a verificar.
 * @returns Un objeto con la propiedad `exists` (boolean).
 */
export async function checkReferenceExistence(code: string): Promise<{ exists: boolean }> {
  if (!code) {
    return { exists: false };
  }

  let connection;
  try {
    connection = await getDbConnection();
    const query = 'SELECT id FROM product WHERE code = ? LIMIT 1;';
    const [rows] = await connection.execute(query, [code]) as any[];
    return { exists: rows.length > 0 };
  } catch (error) {
    console.error('Error al verificar la existencia de la referencia:', error);
    // En caso de error de BD, es más seguro asumir que podría existir
    // para no permitir un duplicado accidental, aunque esto podría bloquear
    // la creación si la BD está caída. Otra estrategia sería retornar false
    // y dejar que la validación final al hacer submit falle.
    // Por ahora, retornamos false para no bloquear al usuario en la UI.
    return { exists: false };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

    