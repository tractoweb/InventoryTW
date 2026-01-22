"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { computeLiquidation, type LiquidationConfig, type LiquidationLineInput, type LiquidationResult } from "@/lib/liquidation";
import { listAllPages } from "@/services/amplify-list-all";
import { documentTypeLabelEs } from "@/lib/document-type-label";

type DocumentHeader = {
  id: number;
  number: string;
  date: string;
  stockdate?: string;
  total: number;
  paidstatus: number;
  warehousename: string;
  documenttypename: string;
  documenttypecode?: string | null;
  documenttypeprinttemplate?: string | null;
  documenttypecategoryid?: number | null;
  customername: string | null;
  customertaxnumber: string | null;
  customercountryname: string | null;
  username: string | null;
  internalnote: string | null;
  note?: string | null;
};

type DocumentItem = {
  id: number;
  productid: number;
  productname: string;
  productcode: string | null;
  productbarcode?: string | null;
  measurementunit?: string | null;
  quantity: number;
  price: number;
  unitcost: number;
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
  posSaleTotals?: {
    ivaPercentage: number;
    grossTotal: number;
    netTotal: number;
    ivaTotal: number;
  };
  liquidation?: {
    config: LiquidationConfig;
    result: LiquidationResult;
  };
};

function safeJsonParse(value: unknown): any | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asPosSaleTotals(value: any): DocumentDetails['posSaleTotals'] | undefined {
  const v = value ?? {};
  const ivaPercentage = Number(v.ivaPercentage ?? v.ivaPct ?? 0);
  const grossTotal = Number(v.grossTotal ?? v.gross ?? 0);
  const netTotal = Number(v.netTotal ?? v.net ?? 0);
  const ivaTotal = Number(v.ivaTotal ?? v.iva ?? 0);

  if (![ivaPercentage, grossTotal, netTotal, ivaTotal].every((n) => Number.isFinite(n))) return undefined;

  return {
    ivaPercentage: Math.max(0, ivaPercentage),
    grossTotal: Math.max(0, grossTotal),
    netTotal: Math.max(0, netTotal),
    ivaTotal: Math.max(0, ivaTotal),
  };
}

function asLiquidationConfig(value: any): LiquidationConfig {
  const cfg = value ?? {};
  return {
    ivaPercentage: Number(cfg.ivaPercentage ?? 0) || 0,
    ivaIncludedInCost: Boolean(cfg.ivaIncludedInCost),
    discountsEnabled: Boolean(cfg.discountsEnabled),
    useMultipleFreights: Boolean(cfg.useMultipleFreights),
    freightRates: Array.isArray(cfg.freightRates)
      ? cfg.freightRates.map((r: any) => ({
          id: String(r?.id ?? ''),
          name: String(r?.name ?? r?.id ?? ''),
          cost: Number(r?.cost ?? 0) || 0,
        }))
      : [],
  };
}

function asLineInputs(value: any): LiquidationLineInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((l: any, idx: number) => ({
      id: String(l?.id ?? idx + 1),
      productId: l?.productId !== undefined ? Number(l.productId) : undefined,
      name: l?.name !== undefined ? String(l.name) : undefined,
      purchaseReference:
        l?.purchaseReference !== undefined
          ? String(l.purchaseReference)
          : l?.purchase_reference !== undefined
            ? String(l.purchase_reference)
            : undefined,
      warehouseReference:
        l?.warehouseReference !== undefined
          ? String(l.warehouseReference)
          : l?.warehouse_reference !== undefined
            ? String(l.warehouse_reference)
            : undefined,
      quantity: Number(l?.quantity ?? 0) || 0,
      totalCost: Number(l?.totalCost ?? 0) || 0,
      discountPercentage: Number(l?.discountPercentage ?? 0) || 0,
      marginPercentage: Number(l?.marginPercentage ?? 0) || 0,
      freightId: String(l?.freightId ?? ''),
    }))
    .filter((l: LiquidationLineInput) => Number.isFinite(l.quantity) && l.quantity >= 0);
}

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

    const [customerResult, clientResult, userResult, warehouseResult, documentTypeResult] = await Promise.all([
      doc.customerId
        ? amplifyClient.models.Customer.get({ idCustomer: Number(doc.customerId) })
        : Promise.resolve({ data: null } as any),
      doc.clientId
        ? amplifyClient.models.Client.get({ idClient: Number(doc.clientId) } as any)
        : Promise.resolve({ data: null } as any),
      amplifyClient.models.User.get({ userId: Number(doc.userId) }),
      amplifyClient.models.Warehouse.get({ idWarehouse: Number(doc.warehouseId) }),
      amplifyClient.models.DocumentType.get({ documentTypeId: Number(doc.documentTypeId) }),
    ]);

    const customer = customerResult?.data as any;
    const client = clientResult?.data as any;
    const user = userResult?.data as any;
    const warehouse = warehouseResult?.data as any;
    const documentType = documentTypeResult?.data as any;

    const templateKey = String(documentType?.printTemplate ?? '').trim();

    const documentCategoryId =
      documentType?.documentCategoryId !== undefined && documentType?.documentCategoryId !== null
        ? Number(documentType.documentCategoryId)
        : null;

    const countryResult = customer?.countryId
      ? await amplifyClient.models.Country.get({ idCountry: Number(customer.countryId) } as any)
      : ({ data: null } as any);
    const country = countryResult?.data as any;

    const itemsResult = await listAllPages<any>((args) => amplifyClient.models.DocumentItem.list(args), {
      filter: { documentId: { eq: Number(documentId) } },
    });
    if ("error" in itemsResult) return { error: itemsResult.error };

    const items = itemsResult.data ?? [];

    // Fetch only needed products (fallback for older documents without snapshots)
    const productIds = Array.from(
      new Set(
        items
          .filter((i: any) => {
            const hasName = typeof i?.productNameSnapshot === 'string' && i.productNameSnapshot.trim().length > 0;
            const hasCode = typeof i?.productCodeSnapshot === 'string' && i.productCodeSnapshot.trim().length > 0;
            return !(hasName && hasCode);
          })
          .map((i: any) => Number(i.productId))
          .filter((id: any) => Number.isFinite(id))
      )
    ) as number[];

    const productGets = await Promise.all(
      productIds.map((id) => amplifyClient.models.Product.get({ idProduct: Number(id) } as any))
    );
    const productById = new Map<number, any>();
    for (let i = 0; i < productIds.length; i++) {
      const p = (productGets[i] as any)?.data;
      if (p) productById.set(productIds[i], p);
    }

    // Sum taxes by documentItemId (best-effort)
    // IMPORTANT: Avoid full-table scans for the common Sale/POS path.
    const taxesByDocumentItemId = new Map<number, number>();
    if (templateKey !== 'Sale') {
      const itemIds = (items ?? [])
        .map((i: any) => Number(i?.documentItemId))
        .filter((id: any) => Number.isFinite(id) && id > 0) as number[];

      // For large documents, skip tax aggregation to protect performance.
      // (Taxes are still available on the document liquidation snapshot for Purchase docs.)
      if (itemIds.length > 0 && itemIds.length <= 50) {
        const chunkSize = 20;
        for (let i = 0; i < itemIds.length; i += chunkSize) {
          const chunk = itemIds.slice(i, i + chunkSize);
          const res = await listAllPages<any>((args) => amplifyClient.models.DocumentItemTax.list(args), {
            filter: { or: chunk.map((id) => ({ documentItemId: { eq: Number(id) } })) },
          } as any);
          if ('error' in res) continue;
          for (const t of res.data ?? []) {
            const documentItemId = Number((t as any).documentItemId);
            const amount = Number((t as any).amount ?? 0);
            if (!Number.isFinite(documentItemId)) continue;
            taxesByDocumentItemId.set(
              documentItemId,
              (taxesByDocumentItemId.get(documentItemId) ?? 0) + (Number.isFinite(amount) ? amount : 0)
            );
          }
        }
      }
    }

    const mappedItems: DocumentItem[] = items
      .map((i: any) => {
        const documentItemId = Number(i.documentItemId);
        const productId = Number(i.productId);
        const prod = productById.get(productId);
        const snapName = typeof i?.productNameSnapshot === 'string' && i.productNameSnapshot.trim().length > 0 ? String(i.productNameSnapshot) : null;
        const snapCode = typeof i?.productCodeSnapshot === 'string' && i.productCodeSnapshot.trim().length > 0 ? String(i.productCodeSnapshot) : null;
        const snapBarcode = typeof i?.barcodeSnapshot === 'string' && i.barcodeSnapshot.trim().length > 0 ? String(i.barcodeSnapshot) : null;
        const snapUnit = typeof i?.measurementUnitSnapshot === 'string' && i.measurementUnitSnapshot.trim().length > 0 ? String(i.measurementUnitSnapshot) : null;
        const quantity = Number(i.quantity ?? 0);
        const unitCost = Number(i.productCost ?? i.price ?? 0);
        const total = Number(i.total ?? quantity * Number(i.price ?? 0));
        return {
          id: documentItemId,
          productid: productId,
          productname: snapName ?? String(prod?.name ?? `#${productId}`),
          productcode: snapCode ?? (prod?.code ? String(prod.code) : null),
          productbarcode: snapBarcode,
          measurementunit: snapUnit,
          quantity,
          price: Number(i.price ?? 0),
          unitcost: Number.isFinite(unitCost) ? unitCost : 0,
          total,
          taxamount: taxesByDocumentItemId.get(documentItemId) ?? 0,
        };
      })
      .sort((a, b) => a.id - b.id);

    // Liquidation snapshot parsing (optional)
    const parsedNote = safeJsonParse(doc.internalNote);
    const posSaleTotals =
      parsedNote?.source === 'POS' &&
      parsedNote?.kind === 'Sale' &&
      parsedNote?.saleTotals
        ? asPosSaleTotals(parsedNote.saleTotals)
        : undefined;

    const isSale = documentCategoryId === 2;
    const isPurchase = documentCategoryId === 1;

    const posCustomerName =
      typeof parsedNote?.customer?.name === 'string' && parsedNote.customer.name.trim().length > 0
        ? String(parsedNote.customer.name).trim()
        : null;
    const posCustomerTaxNumber =
      typeof parsedNote?.customer?.taxNumber === 'string' && parsedNote.customer.taxNumber.trim().length > 0
        ? String(parsedNote.customer.taxNumber).trim()
        : null;

    const clientNameSnapshot =
      typeof doc.clientNameSnapshot === 'string' && String(doc.clientNameSnapshot).trim().length > 0
        ? String(doc.clientNameSnapshot).trim()
        : null;
    const clientNameFromTable =
      typeof client?.name === 'string' && String(client.name).trim().length > 0 ? String(client.name).trim() : null;
    const computedSaleClientName =
      clientNameSnapshot ?? clientNameFromTable ?? posCustomerName ?? (parsedNote?.source === 'POS' && parsedNote?.kind === 'Sale' ? 'Anónimo' : null);

    const thirdPartyName = isSale ? computedSaleClientName : isPurchase ? (customer ? String(customer.name ?? '') : null) : (customer ? String(customer.name ?? '') : null);
    const thirdPartyTaxNumber = isSale
      ? (typeof client?.taxNumber === 'string' && String(client.taxNumber).trim().length > 0
          ? String(client.taxNumber).trim()
          : posCustomerTaxNumber)
      : customer
        ? String(customer.taxNumber ?? '')
        : null;
    const thirdPartyCountryName = isPurchase ? (country ? String(country.name ?? '') : null) : null;
    const snapshot = parsedNote?.liquidation ?? null;
    const config = asLiquidationConfig(snapshot?.config ?? snapshot);

    let lineInputs = asLineInputs(snapshot?.lineInputs ?? snapshot?.lines);
    if (!lineInputs.length) {
      // Fallback: build a simple liquidation view from stored document items.
      const fallbackFreightId = String(config.freightRates?.[0]?.id ?? '');
      lineInputs = mappedItems.map((it, idx) => ({
        id: String(idx + 1),
        productId: it.productid,
        name: it.productname,
        quantity: it.quantity,
        totalCost: it.total,
        discountPercentage: 0,
        marginPercentage: 0,
        freightId: fallbackFreightId,
      }));
    }

    const liquidationResult = computeLiquidation(config, lineInputs);

    const paymentsResult = await listAllPages<any>((args) => amplifyClient.models.Payment.list(args), {
      filter: { documentId: { eq: Number(documentId) } },
    });
    if ("error" in paymentsResult) return { error: paymentsResult.error };

    // Payment types: fetch only the ones referenced by this document.
    const paymentTypeIds = Array.from(
      new Set(
        (paymentsResult.data ?? [])
          .map((p: any) => Number(p?.paymentTypeId))
          .filter((id: any) => Number.isFinite(id) && id > 0)
      )
    ) as number[];

    const paymentTypeGets = await Promise.all(
      paymentTypeIds.map((id) => amplifyClient.models.PaymentType.get({ paymentTypeId: Number(id) } as any))
    );
    const paymentTypeById = new Map<number, string>();
    for (let i = 0; i < paymentTypeIds.length; i++) {
      const pt = (paymentTypeGets[i] as any)?.data;
      if (pt) paymentTypeById.set(paymentTypeIds[i], String((pt as any)?.name ?? ''));
    }

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
      stockdate: doc.stockDate ? String(doc.stockDate) : undefined,
      total: Number(doc.total ?? 0),
      paidstatus: Number(doc.paidStatus ?? 0),
      warehousename: String(warehouse?.name ?? ""),
      documenttypename: documentTypeLabelEs({
        name: documentType?.name ?? null,
        printTemplate: documentType?.printTemplate ?? null,
        code: documentType?.code ?? null,
        languageKey: documentType?.languageKey ?? null,
      }),
      documenttypecode: documentType?.code ?? null,
      documenttypeprinttemplate: documentType?.printTemplate ?? null,
      documenttypecategoryid: documentCategoryId,
      customername: thirdPartyName,
      customertaxnumber: thirdPartyTaxNumber,
      customercountryname: thirdPartyCountryName,
      username: user ? String(user.username ?? "") : null,
      internalnote: doc.internalNote ? String(doc.internalNote) : null,
      note: doc.note ? String(doc.note) : null,
      items: mappedItems,
      payments: mappedPayments,
      posSaleTotals,
      liquidation: {
        config,
        result: liquidationResult,
      },
    };

    return { data };
  } catch (error: any) {
    return { error: formatAmplifyError(error) || error.message || 'Error fetching document details from the database.' };
  }
}
