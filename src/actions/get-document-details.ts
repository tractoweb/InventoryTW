"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

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

export async function getDocumentDetails(documentId: number) {
  // Details page should always fetch fresh data
  noStore();
  
  if (!documentId) {
    return { error: 'Document ID is required.' };
  }

  try {
    const docResult = await amplifyClient.models.Document.get({ documentId: Number(documentId) });
    const doc = docResult.data as any;
    if (!doc) return { error: "Document not found." };

    const [customerResult, userResult, warehouseResult, documentTypeResult] = await Promise.all([
      doc.customerId
        ? amplifyClient.models.Customer.get({ idCustomer: Number(doc.customerId) })
        : Promise.resolve({ data: null } as any),
      amplifyClient.models.User.get({ userId: Number(doc.userId) }),
      amplifyClient.models.Warehouse.get({ idWarehouse: Number(doc.warehouseId) }),
      amplifyClient.models.DocumentType.get({ documentTypeId: Number(doc.documentTypeId) }),
    ]);

    const customer = customerResult?.data as any;
    const user = userResult?.data as any;
    const warehouse = warehouseResult?.data as any;
    const documentType = documentTypeResult?.data as any;

    const itemsResult = await listAllPages<any>((args) => amplifyClient.models.DocumentItem.list(args), {
      filter: { documentId: { eq: Number(documentId) } },
    });
    if ("error" in itemsResult) return { error: itemsResult.error };

    const items = itemsResult.data ?? [];

    // Map product names
    const productsResult = await listAllPages<any>((args) => amplifyClient.models.Product.list(args));
    const products = "error" in productsResult ? [] : productsResult.data ?? [];
    const productById = new Map<number, string>(
      products.map((p: any) => [Number(p.idProduct), String(p.name ?? "")])
    );

    // Sum taxes by documentItemId (best-effort)
    const taxesByDocumentItemId = new Map<number, number>();
    const allItemTaxesResult = await listAllPages<any>((args) => amplifyClient.models.DocumentItemTax.list(args));
    if (!("error" in allItemTaxesResult)) {
      for (const t of allItemTaxesResult.data ?? []) {
        const documentItemId = Number((t as any).documentItemId);
        const amount = Number((t as any).amount ?? 0);
        if (!Number.isFinite(documentItemId)) continue;
        taxesByDocumentItemId.set(
          documentItemId,
          (taxesByDocumentItemId.get(documentItemId) ?? 0) + (Number.isFinite(amount) ? amount : 0)
        );
      }
    }

    const mappedItems: DocumentItem[] = items
      .map((i: any) => {
        const documentItemId = Number(i.documentItemId);
        const productId = Number(i.productId);
        return {
          id: documentItemId,
          productname: productById.get(productId) ?? `#${productId}`,
          quantity: Number(i.quantity ?? 0),
          price: Number(i.price ?? 0),
          total: Number(i.total ?? 0),
          taxamount: taxesByDocumentItemId.get(documentItemId) ?? 0,
        };
      })
      .sort((a, b) => a.id - b.id);

    const paymentsResult = await listAllPages<any>((args) => amplifyClient.models.Payment.list(args), {
      filter: { documentId: { eq: Number(documentId) } },
    });
    if ("error" in paymentsResult) return { error: paymentsResult.error };

    const paymentTypesResult = await listAllPages<any>((args) => amplifyClient.models.PaymentType.list(args));
    const paymentTypes = "error" in paymentTypesResult ? [] : paymentTypesResult.data ?? [];
    const paymentTypeById = new Map<number, string>(
      paymentTypes.map((pt: any) => [Number(pt.paymentTypeId), String(pt.name ?? "")])
    );

    const mappedPayments: DocumentPayment[] = (paymentsResult.data ?? [])
      .map((p: any) => {
        const paymentId = Number(p.paymentId);
        const paymentTypeId = Number(p.paymentTypeId);
        return {
          id: paymentId,
          date: String(p.date ?? ""),
          amount: Number(p.amount ?? 0),
          paymenttypename: paymentTypeById.get(paymentTypeId) ?? `#${paymentTypeId}`,
        };
      })
      .sort((a, b) => a.id - b.id);

    const data: DocumentDetails = {
      id: Number(doc.documentId),
      number: String(doc.number ?? ""),
      date: String(doc.date ?? ""),
      total: Number(doc.total ?? 0),
      paidstatus: Number(doc.paidStatus ?? 0),
      warehousename: String(warehouse?.name ?? ""),
      documenttypename: String(documentType?.name ?? ""),
      customername: customer ? String(customer.name ?? "") : null,
      customertaxnumber: customer ? String(customer.taxNumber ?? "") : null,
      username: user ? String(user.username ?? "") : null,
      items: mappedItems,
      payments: mappedPayments,
    };

    return { data };
  } catch (error: any) {
    return { error: formatAmplifyError(error) || error.message || 'Error fetching document details from the database.' };
  }
}
