'use server';

import { getDbConnection, closeDbConnection } from '@/lib/db-connection';

export async function checkDbConnection() {
  try {
    const connection = await getDbConnection();
    if (connection) {
      // The connection object exists, but let's ping to be sure
      await connection.ping();
      await closeDbConnection();
      return { status: 'success', message: 'Conexión exitosa' };
    }
    // This case should ideally not be hit if getDbConnection throws error on failure
    return { status: 'error', message: 'No se pudo obtener el objeto de conexión' };
  } catch (error: any) {
    // Check for specific MySQL error codes
    if (error.code === 'ENOTFOUND') {
        return { status: 'error', message: 'Host de BD no encontrado. Revise la dirección.' };
    }
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        return { status: 'error', message: 'Acceso denegado. Revise las credenciales.' };
    }
    if (error.code === 'ER_BAD_DB_ERROR') {
        return { status: 'error', message: 'Base de datos no encontrada.' };
    }
    return { status: 'error', message: error.message || 'Ocurrió un error desconocido' };
  }
}
