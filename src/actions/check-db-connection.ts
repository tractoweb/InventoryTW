'use server';

import { getDbConnection, closeDbConnection } from '@/lib/db-connection';

export async function checkDbConnection() {
  try {
    const connection = await getDbConnection();
    if (connection) {
      // The connection object exists, but let's ping to be sure
      await connection.ping();
      await closeDbConnection();
      return { status: 'success', message: 'Connection successful' };
    }
    // This case should ideally not be hit if getDbConnection throws error on failure
    return { status: 'error', message: 'Failed to get connection object' };
  } catch (error: any) {
    // Check for specific MySQL error codes
    if (error.code === 'ENOTFOUND') {
        return { status: 'error', message: 'DB host not found. Check address.' };
    }
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        return { status: 'error', message: 'Access denied. Check credentials.' };
    }
    if (error.code === 'ER_BAD_DB_ERROR') {
        return { status: 'error', message: 'Database not found.' };
    }
    return { status: 'error', message: error.message || 'An unknown error occurred' };
  }
}
