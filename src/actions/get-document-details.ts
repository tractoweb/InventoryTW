"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { computeLiquidation, type LiquidationConfig, type LiquidationLineInput, type LiquidationResult } from "@/lib/liquidation";
import { listAllPages } from "@/services/amplify-list-all";

type DocumentHeader = {
  id: number;
  number: string;
  date: string;
  stockdate?: string;
  total: number;
  paidstatus: number;
  warehousename: string;
  documenttypename: string;
  customername: string | null;
  customertaxnumber: string | null;
  customercountryname: string | null;
  username: string | null;
  internalnote: string | null;
};

type DocumentItem = {
  id: number;
  productid: number;
  productname: string;
  productcode: string | null;
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

    const countryResult = customer?.countryId
      ? await amplifyClient.models.Country.get({ idCountry: Number(customer.countryId) } as any)
      : ({ data: null } as any);
    const country = countryResult?.data as any;

    const itemsResult = await listAllPages<any>((args) => amplifyClient.models.DocumentItem.list(args), {
      filter: { documentId: { eq: Number(documentId) } },
    });
    if ("error" in itemsResult) return { error: itemsResult.error };

    const items = itemsResult.data ?? [];

    // Fetch only needed products (faster than listing all products)
    const productIds = Array.from(
      new Set(items.map((i: any) => Number(i.productId)).filter((id: any) => Number.isFinite(id)))
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
        const prod = productById.get(productId);
        const quantity = Number(i.quantity ?? 0);
        const unitCost = Number(i.productCost ?? i.price ?? 0);
        const total = Number(i.total ?? quantity * Number(i.price ?? 0));
        return {
          id: documentItemId,
          productid: productId,
          productname: String(prod?.name ?? `#${productId}`),
          productcode: prod?.code ? String(prod.code) : null,
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
      stockdate: doc.stockDate ? String(doc.stockDate) : undefined,
      total: Number(doc.total ?? 0),
      paidstatus: Number(doc.paidStatus ?? 0),
      warehousename: String(warehouse?.name ?? ""),
      documenttypename: String(documentType?.name ?? ""),
      customername: customer ? String(customer.name ?? "") : null,
      customertaxnumber: customer ? String(customer.taxNumber ?? "") : null,
      customercountryname: country ? String(country.name ?? '') : null,
      username: user ? String(user.username ?? "") : null,
      internalnote: doc.internalNote ? String(doc.internalNote) : null,
      items: mappedItems,
      payments: mappedPayments,
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
