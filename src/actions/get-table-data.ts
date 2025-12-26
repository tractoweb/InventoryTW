'use server';

import { queryDatabase } from '@/lib/db-connection';
import { unstable_noStore as noStore } from 'next/cache';

// Lista blanca de tablas permitidas para evitar consultas arbitrarias
const ALLOWED_TABLES = [
    'applicationproperty',
    'barcode',
    'company',
    'counter',
    'country',
    'currency',
    'customer',
    'customerdiscount',
    'document',
    'documentcategory',
    'documentitem',
    'documentitemexpirationdate',
    'documentitemtax',
    'documenttype',
    'fiscalitem',
    'floorplan',
    'floorplantable',
    'loyaltycard',
    'migration',
    'payment',
    'paymenttype',
    'posorder',
    'posorderitem',
    'posprinterselection',
    'posprinterselectionsettings',
    'posprintersettings',
    'posvoid',
    'product',
    'productcomment',
    'productgroup',
    'producttax',
    'promotion',
    'promotionitem',
    'securitykey',
    'startingcash',
    'stock',
    'stockcontrol',
    'tax',
    'template',
    'user',
    'voidreason',
    'warehouse',
    'zreport',
  ];

export async function getTableData(tableName: string) {
  noStore();
  if (!ALLOWED_TABLES.includes(tableName)) {
    console.error(`Acceso denegado: La tabla '${tableName}' no está permitida.`);
    throw new Error('Tabla no permitida');
  }

  try {
    const query = `SELECT * FROM ${tableName} LIMIT 500;`; // Usar nombres de tabla en minúscula
    const data = await queryDatabase(query);
    
    if (Array.isArray(data) && data.length > 0) {
        // Asegurarse de que las claves estén en minúscula si la BD las devuelve en mayúscula/mixto
        const lowercasedData = data.map(row => {
            const newRow: {[key: string]: any} = {};
            for (const key in row) {
                newRow[key.toLowerCase()] = (row as any)[key];
            }
            return newRow;
        });
        const columns = Object.keys(lowercasedData[0]);
        return { data: lowercasedData, columns };
    }
    
    return { data: [], columns: [] };
  } catch (error: any) {
    console.error(`Error al obtener datos de la tabla ${tableName}:`, error);
    return { error: error.message || 'Error al obtener datos de la base de datos.' };
  }
}
