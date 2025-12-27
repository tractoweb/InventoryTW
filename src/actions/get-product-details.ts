
'use server';

import { queryDatabase } from '@/lib/db-connection';
import { unstable_noStore as noStore } from 'next/cache';

// Helper function to convert Buffer to string for serialization
const sanitizeRow = (row: any) => {
    const newRow: {[key: string]: any} = {};
    for (const key in row) {
        const value = row[key];
        if (Buffer.isBuffer(value)) {
            newRow[key] = '[Binary Data]'; // Placeholder for images/blobs
        } else if (value instanceof Date) {
            newRow[key] = value.toISOString();
        } 
        else {
            newRow[key] = value;
        }
    }
    return newRow;
};


export async function getProductDetails(productId: number) {
  // Details page should always fetch fresh data
  noStore();
  
  if (!productId) {
    return { error: 'Product ID is required.' };
  }

  try {
    const productQuery = `
      SELECT 
        p.*,
        pg.name as productgroupname,
        c.name as currencyname,
        c.code as currencycode,
        (SELECT SUM(s.quantity) FROM stock s WHERE s.productid = p.id) AS totalstock,
        (SELECT GROUP_CONCAT(t.name SEPARATOR ', ') FROM producttax pt JOIN tax t ON pt.taxid = t.id WHERE pt.productid = p.id) as taxes,
        (SELECT GROUP_CONCAT(b.value SEPARATOR ', ') FROM barcode b WHERE b.productid = p.id) as barcodes
      FROM product p
      LEFT JOIN productgroup pg ON p.productgroupid = pg.id
      LEFT JOIN currency c ON p.currencyid = c.id
      WHERE p.id = ?;
    `;
    
    const [productData] = await queryDatabase(productQuery, [productId]) as any[];

    if (!productData) {
        return { error: 'Product not found.' };
    }

    const stockQuery = `
        SELECT w.name as warehousename, s.quantity 
        FROM stock s
        JOIN warehouse w ON s.warehouseid = w.id
        WHERE s.productid = ?;
    `;
    const stockData = await queryDatabase(stockQuery, [productId]) as any[];

    return { 
        data: {
            ...sanitizeRow(productData),
            stocklocations: stockData.map(sanitizeRow)
        }
    };

  } catch (error: any) {
    console.error(`Error getting details for product ${productId}:`, error);
    return { error: error.message || 'Error fetching product details from the database.' };
  }
}
