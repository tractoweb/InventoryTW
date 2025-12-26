'use server';

import { queryDatabase } from '@/lib/db-connection';
import { unstable_noStore as noStore } from 'next/cache';

type DocumentHeader = {
  id: number;
  number: string;
  date: string;
  total: number;
  paidstatus: number;
  warehousename: string;
  documenttypename: string;
  customername: string | null;
  customertaxnumber: string | null;
  username: string | null;
};

type DocumentItem = {
  id: number;
  productname: string;
  quantity: number;
  price: number;
  total: number;
  taxamount: number;
};

type DocumentPayment = {
  id: number;
  date: string;
  amount: number;
  paymenttypename: string;
};

export type DocumentDetails = DocumentHeader & {
  items: DocumentItem[];
  payments: DocumentPayment[];
};

const sanitizeRow = (row: any) => {
    const newRow: {[key: string]: any} = {};
    for (const key in row) {
        const value = row[key];
        if (value instanceof Date) {
            newRow[key] = value.toISOString();
        } else {
            newRow[key] = value;
        }
    }
    return newRow;
};

export async function getDocumentDetails(documentId: number) {
  noStore();
  
  if (!documentId) {
    return { error: 'Document ID is required.' };
  }

  try {
    // 1. Get Document Header
    const headerQuery = `
      SELECT 
        d.id,
        d.number,
        d.date,
        d.total,
        d.paidstatus,
        w.name AS warehousename,
        dt.name AS documenttypename,
        c.name AS customername,
        c.taxnumber AS customertaxnumber,
        u.username
      FROM document d
      LEFT JOIN warehouse w ON d.warehouseid = w.id
      LEFT JOIN documenttype dt ON d.documenttypeid = dt.id
      LEFT JOIN customer c ON d.customerid = c.id
      LEFT JOIN user u ON d.userid = u.id
      WHERE d.id = ?;
    `;
    const [headerData] = await queryDatabase(headerQuery, [documentId]) as any[];

    if (!headerData) {
      return { error: 'Document not found.' };
    }

    // 2. Get Document Items
    const itemsQuery = `
      SELECT 
        di.id,
        p.name AS productname,
        di.quantity,
        di.price,
        di.total,
        (SELECT SUM(dit.amount) FROM documentitemtax dit WHERE dit.documentitemid = di.id) as taxamount
      FROM documentitem di
      JOIN product p ON di.productid = p.id
      WHERE di.documentid = ?;
    `;
    const itemsData = await queryDatabase(itemsQuery, [documentId]) as any[];
    
    // 3. Get Payments
    const paymentsQuery = `
      SELECT 
        p.id,
        p.date,
        p.amount,
        pt.name as paymenttypename
      FROM payment p
      JOIN paymenttype pt ON p.paymenttypeid = pt.id
      WHERE p.documentid = ?;
    `;
    const paymentsData = await queryDatabase(paymentsQuery, [documentId]) as any[];

    const details: DocumentDetails = {
        ...(sanitizeRow(headerData) as DocumentHeader),
        items: itemsData.map(item => sanitizeRow(item) as DocumentItem),
        payments: paymentsData.map(payment => sanitizeRow(payment) as DocumentPayment),
    };

    return { data: details };

  } catch (error: any) {
    console.error(`Error getting details for document ${documentId}:`, error);
    return { error: error.message || 'Error fetching document details from the database.' };
  }
}
