
import { documentService } from '@/services/document-service';
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
  // Details page should always fetch fresh data
  noStore();
  
  if (!documentId) {
    return { error: 'Document ID is required.' };
  }

  try {
    // TODO: Implement document details fetching from Amplify
    // Use documentService when available
    const data: DocumentDetails = {
      id: documentId,
      number: '',
      date: new Date().toISOString(),
      total: 0,
      paidstatus: 0,
      warehousename: '',
      documenttypename: '',
      customername: null,
      customertaxnumber: null,
      username: null,
      items: [],
      payments: []
    };
    return { data };

  } catch (error: any) {
    console.error(`Error getting details for document ${documentId}:`, error);
    return { error: error.message || 'Error fetching document details from the database.' };
  }
}
