
'use server';

import { queryDatabase } from '@/lib/db-connection';
import { unstable_noStore as noStore } from 'next/cache';

// Helper function to convert Buffer to string and keys to lowercase for serialization
const sanitizeRow = (row: any) => {
    if (!row) return null;
    const newRow: {[key: string]: any} = {};
    for (const key in row) {
        const value = row[key];
        const lowerKey = key.toLowerCase();
        if (Buffer.isBuffer(value)) {
            newRow[lowerKey] = '[Binary Data]'; // Placeholder for images/blobs
        } else if (value instanceof Date) {
            newRow[lowerKey] = value.toISOString();
        } 
        else {
            newRow[lowerKey] = value;
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
        p.id,
        p.productgroupid,
        p.name,
        p.code,
        p.plu,
        p.measurementunit,
        p.price,
        p.istaxinclusiveprice,
        p.currencyid,
        p.ispricechangeallowed,
        p.isservice,
        p.isusingdefaultquantity,
        p.isenabled,
        p.description,
        p.datecreated,
        p.dateupdated,
        p.cost,
        p.markup,
        p.image,
        p.color,
        p.agerestriction,
        p.lastpurchaseprice,
        p.rank,
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
    
    const sanitizedProductData = sanitizeRow(productData);

    return { 
        data: {
            ...sanitizedProductData,
            stocklocations: stockData.map(sanitizeRow)
        }
    };

  } catch (error: any) {
    console.error(`Error getting details for product ${productId}:`, error);
    return { error: error.message || 'Error fetching product details from the database.' };
  }
}

