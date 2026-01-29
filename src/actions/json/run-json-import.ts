'use server';

import { amplifyClient } from '@/lib/amplify-server';
import { formatAmplifyError } from '@/lib/amplify-config';

export const JSON_IMPORT_KINDS = [
  'barcode',
  'company',
  'counter',
  'currency',
  'customer',
  'customerDiscount',
  'document',
  'documentcategory',
  'documentitem',
  'documentitempriceview',
  'documentitemtax',
  'documenttype',
  'paises',
  'payment',
  'paymenttype',
  'product',
  'productgroups',
  'producttax',
  'startingcash',
  'stock',
  'stockcontrol',
  'tax',
  'user',
  'warehouse',
  'zreport',
] as const;

export type JsonImportKind = (typeof JSON_IMPORT_KINDS)[number];

export type JsonImportLogRow = {
  id: string | number;
  name?: string;
  status: 'nuevo' | 'existente' | 'error';
  message?: string;
};

function normalizeRow(row: any): any {
  return row ?? {};
}

async function loadJsonData(kind: JsonImportKind): Promise<any[]> {
  switch (kind) {
    case 'barcode':
      return ((await import('@/lib/data/Barcode.json')) as any).default ?? [];
    case 'company':
      return ((await import('@/lib/data/Company.json')) as any).default ?? [];
    case 'counter':
      return ((await import('@/lib/data/Counter.json')) as any).default ?? [];
    case 'currency':
      return ((await import('@/lib/data/Currency.json')) as any).default ?? [];
    case 'customer':
      return ((await import('@/lib/data/Customer.json')) as any).default ?? [];
    case 'customerDiscount':
      return ((await import('@/lib/data/CustomerDiscount.json')) as any).default ?? [];
    case 'document':
      return ((await import('@/lib/data/Document.json')) as any).default ?? [];
    case 'documentcategory':
      return ((await import('@/lib/data/DocumentCategory.json')) as any).default ?? [];
    case 'documentitem':
      return ((await import('@/lib/data/DocumentItem.json')) as any).default ?? [];
    case 'documentitempriceview':
      return ((await import('@/lib/data/DocumentItemPriceView.json')) as any).default ?? [];
    case 'documentitemtax':
      return ((await import('@/lib/data/DocumentItemTax.json')) as any).default ?? [];
    case 'documenttype':
      return ((await import('@/lib/data/DocumentType.json')) as any).default ?? [];
    case 'paises':
      return ((await import('@/lib/data/Country.json')) as any).default ?? [];
    case 'payment':
      return ((await import('@/lib/data/Payment.json')) as any).default ?? [];
    case 'paymenttype':
      return ((await import('@/lib/data/PaymentType.json')) as any).default ?? [];
    case 'product':
      return ((await import('@/lib/data/Product.json')) as any).default ?? [];
    case 'productgroups':
      return ((await import('@/lib/data/ProductGroup.json')) as any).default ?? [];
    case 'producttax':
      return ((await import('@/lib/data/ProductTax.json')) as any).default ?? [];
    case 'startingcash':
      return ((await import('@/lib/data/StartingCash.json')) as any).default ?? [];
    case 'stock':
      return ((await import('@/lib/data/Stock.json')) as any).default ?? [];
    case 'stockcontrol':
      return ((await import('@/lib/data/StockControl.json')) as any).default ?? [];
    case 'tax':
      return ((await import('@/lib/data/Tax.json')) as any).default ?? [];
    case 'user':
      return ((await import('@/lib/data/User.json')) as any).default ?? [];
    case 'warehouse':
      return ((await import('@/lib/data/Warehouse.json')) as any).default ?? [];
    case 'zreport':
      return ((await import('@/lib/data/ZReport.json')) as any).default ?? [];
    default:
      return [];
  }
}

function isDuplicateLikeError(message: string): boolean {
  const msg = String(message ?? '').toLowerCase();
  return (
    msg.includes('conditionalcheckfailed') ||
    msg.includes('conditional request failed') ||
    msg.includes('already exists') ||
    msg.includes('duplicate') ||
    msg.includes('conflict')
  );
}

function configForKind(kind: JsonImportKind): {
  modelName: string;
  keyOf: (row: any) => string;
  nameOf: (row: any) => string | undefined;
  toCreate: (row: any) => any;
} {
  switch (kind) {
    case 'barcode':
      return {
        modelName: 'Barcode',
        keyOf: (row) => {
          const r = normalizeRow(row);
          return `${r.productId ?? r.ProductId ?? ''}:${r.value ?? r.Value ?? ''}`;
        },
        nameOf: (row) => {
          const r = normalizeRow(row);
          return String(r.value ?? r.Value ?? '');
        },
        toCreate: (row) => normalizeRow(row),
      };
    case 'tax':
      return {
        modelName: 'Tax',
        keyOf: (row) => String(normalizeRow(row).idTax ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => {
          const r = normalizeRow(row);
          return {
            idTax: r.idTax ?? r.Id,
            name: r.name ?? r.Name,
            rate: r.rate ?? r.Rate ?? 0,
            code: r.code ?? r.Code ?? '',
            isFixed: !!(r.isFixed ?? r.IsFixed),
            isTaxOnTotal: !!(r.isTaxOnTotal ?? r.IsTaxOnTotal),
            isEnabled: r.isEnabled !== undefined ? !!r.isEnabled : r.IsEnabled !== undefined ? !!r.IsEnabled : true,
          };
        },
      };
    case 'currency':
      return {
        modelName: 'Currency',
        keyOf: (row) => String(normalizeRow(row).idCurrency ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => {
          const r = normalizeRow(row);
          return {
            idCurrency: r.idCurrency ?? r.Id,
            name: r.name ?? r.Name,
            code: r.code ?? r.Code ?? '',
          };
        },
      };
    case 'warehouse':
      return {
        modelName: 'Warehouse',
        keyOf: (row) => String(normalizeRow(row).idWarehouse ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => {
          const r = normalizeRow(row);
          return {
            idWarehouse: r.idWarehouse ?? r.Id,
            name: r.name ?? r.Name,
            address: r.address ?? r.Address,
            isEnabled: r.isEnabled !== undefined ? !!r.isEnabled : r.IsEnabled !== undefined ? !!r.IsEnabled : true,
          };
        },
      };
    case 'productgroups':
      return {
        modelName: 'ProductGroup',
        keyOf: (row) => String(normalizeRow(row).idProductGroup ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => {
          const r = normalizeRow(row);
          return {
            idProductGroup: r.idProductGroup ?? r.Id,
            name: r.name ?? r.Name,
            isEnabled: r.isEnabled !== undefined ? !!r.isEnabled : r.IsEnabled !== undefined ? !!r.IsEnabled : true,
          };
        },
      };
    case 'paymenttype':
      return {
        modelName: 'PaymentType',
        keyOf: (row) => String(normalizeRow(row).idPaymentType ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => {
          const r = normalizeRow(row);
          return {
            idPaymentType: r.idPaymentType ?? r.Id,
            name: r.name ?? r.Name,
            isEnabled: r.isEnabled !== undefined ? !!r.isEnabled : r.IsEnabled !== undefined ? !!r.IsEnabled : true,
          };
        },
      };
    case 'documenttype':
      return {
        modelName: 'DocumentType',
        keyOf: (row) => String(normalizeRow(row).documentTypeId ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => {
          const r = normalizeRow(row);
          return {
            documentTypeId: r.documentTypeId ?? r.Id,
            name: r.name ?? r.Name,
            code: r.code ?? r.Code,
            stockDirection: r.stockDirection ?? r.StockDirection,
            isEnabled: r.isEnabled !== undefined ? !!r.isEnabled : r.IsEnabled !== undefined ? !!r.IsEnabled : true,
          };
        },
      };
    case 'documentcategory':
      return {
        modelName: 'DocumentCategory',
        keyOf: (row) => String(normalizeRow(row).documentCategoryId ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => {
          const r = normalizeRow(row);
          return {
            documentCategoryId: r.documentCategoryId ?? r.Id,
            name: r.name ?? r.Name,
            isEnabled: r.isEnabled !== undefined ? !!r.isEnabled : r.IsEnabled !== undefined ? !!r.IsEnabled : true,
          };
        },
      };
    case 'company':
      return {
        modelName: 'Company',
        keyOf: (row) => String(normalizeRow(row).idCompany ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => {
          const r = normalizeRow(row);
          return {
            idCompany: r.idCompany ?? r.Id,
            name: r.name ?? r.Name,
            address: r.address ?? r.Address,
            city: r.city ?? r.City,
            postalCode: r.postalCode ?? r.PostalCode,
            countryId: r.countryId ?? r.CountryId,
            taxNumber: r.taxNumber ?? r.TaxNumber,
            email: r.email ?? r.Email,
            phoneNumber: r.phoneNumber ?? r.PhoneNumber,
            isEnabled: r.isEnabled !== undefined ? !!r.isEnabled : r.IsEnabled !== undefined ? !!r.IsEnabled : true,
          };
        },
      };
    case 'counter':
      return {
        modelName: 'Counter',
        keyOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => {
          const r = normalizeRow(row);
          return {
            name: r.name ?? r.Name,
            value: Number(r.value ?? r.Value ?? 0),
            updatedAt: r.updatedAt ?? r.UpdatedAt,
          };
        },
      };
    case 'paises':
      return {
        modelName: 'Country',
        keyOf: (row) => String(normalizeRow(row).idCountry ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => {
          const r = normalizeRow(row);
          return {
            idCountry: r.idCountry ?? r.Id,
            name: r.name ?? r.Name,
            code: r.code ?? r.Code,
            isEnabled: r.isEnabled !== undefined ? !!r.isEnabled : r.IsEnabled !== undefined ? !!r.IsEnabled : true,
          };
        },
      };
    case 'customer':
      return {
        modelName: 'Customer',
        keyOf: (row) => String(normalizeRow(row).idCustomer ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => normalizeRow(row),
      };
    case 'user':
      return {
        modelName: 'User',
        keyOf: (row) => String(normalizeRow(row).userId ?? normalizeRow(row).UserId ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).username ?? normalizeRow(row).Username ?? ''),
        toCreate: (row) => normalizeRow(row),
      };
    case 'product':
      return {
        modelName: 'Product',
        keyOf: (row) => String(normalizeRow(row).idProduct ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => normalizeRow(row),
      };
    case 'producttax':
      return {
        modelName: 'ProductTax',
        keyOf: (row) => {
          const r = normalizeRow(row);
          return `${r.productId ?? r.ProductId ?? ''}:${r.taxId ?? r.TaxId ?? ''}`;
        },
        nameOf: () => undefined,
        toCreate: (row) => normalizeRow(row),
      };
    case 'document':
      return {
        modelName: 'Document',
        keyOf: (row) => String(normalizeRow(row).idDocument ?? normalizeRow(row).documentId ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).number ?? normalizeRow(row).Number ?? ''),
        toCreate: (row) => normalizeRow(row),
      };
    case 'documentitem':
      return {
        modelName: 'DocumentItem',
        keyOf: (row) => String(normalizeRow(row).idDocumentItem ?? normalizeRow(row).documentItemId ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).name ?? normalizeRow(row).Name ?? ''),
        toCreate: (row) => normalizeRow(row),
      };
    case 'documentitemtax':
      return {
        modelName: 'DocumentItemTax',
        keyOf: (row) => JSON.stringify(normalizeRow(row)),
        nameOf: () => undefined,
        toCreate: (row) => normalizeRow(row),
      };
    case 'documentitempriceview':
      return {
        modelName: 'DocumentItemPriceView',
        keyOf: (row) => JSON.stringify(normalizeRow(row)),
        nameOf: () => undefined,
        toCreate: (row) => normalizeRow(row),
      };
    case 'payment':
      return {
        modelName: 'Payment',
        keyOf: (row) => String(normalizeRow(row).idPayment ?? normalizeRow(row).paymentId ?? normalizeRow(row).Id),
        nameOf: (row) => String(normalizeRow(row).paymentNumber ?? normalizeRow(row).number ?? ''),
        toCreate: (row) => normalizeRow(row),
      };
    case 'startingcash':
      return {
        modelName: 'StartingCash',
        keyOf: (row) => String(normalizeRow(row).idStartingCash ?? normalizeRow(row).Id),
        nameOf: () => undefined,
        toCreate: (row) => normalizeRow(row),
      };
    case 'stock':
      return {
        modelName: 'Stock',
        keyOf: (row) => JSON.stringify(normalizeRow(row)),
        nameOf: () => undefined,
        toCreate: (row) => normalizeRow(row),
      };
    case 'stockcontrol':
      return {
        modelName: 'StockControl',
        keyOf: (row) => String(normalizeRow(row).idStockControl ?? normalizeRow(row).Id),
        nameOf: () => undefined,
        toCreate: (row) => normalizeRow(row),
      };
    case 'customerDiscount':
      return {
        modelName: 'CustomerDiscount',
        keyOf: (row) => JSON.stringify(normalizeRow(row)),
        nameOf: () => undefined,
        toCreate: (row) => normalizeRow(row),
      };
    case 'zreport':
      return {
        modelName: 'ZReport',
        keyOf: (row) => String(normalizeRow(row).idZReport ?? normalizeRow(row).Id),
        nameOf: () => undefined,
        toCreate: (row) => normalizeRow(row),
      };
    // For the remaining kinds, assume the JSON already matches Amplify model fields.
    default:
      return {
        modelName: kind,
        keyOf: (row) => JSON.stringify(normalizeRow(row)),
        nameOf: () => undefined,
        toCreate: (row) => normalizeRow(row),
      };
  }
}

export async function runJsonImportAction(kind: JsonImportKind): Promise<{ success: boolean; results: JsonImportLogRow[]; error?: string }> {
  try {
    const cfg = configForKind(kind);
    const rows = ((await loadJsonData(kind)) ?? []) as any[];

    const results: JsonImportLogRow[] = [];

    for (const rawRow of rows) {
      const row = normalizeRow(rawRow);
      const id = cfg.keyOf(row);
      const name = cfg.nameOf(row) || undefined;

      try {
        const createRes = await (amplifyClient.models as any)[cfg.modelName].create(cfg.toCreate(row));
        if (createRes?.data) {
          results.push({ id, name, status: 'nuevo' });
          continue;
        }

        const msg = (createRes?.errors?.[0]?.message as string | undefined) ?? 'No se pudo crear el registro';
        if (isDuplicateLikeError(msg)) {
          results.push({ id, name, status: 'existente', message: 'Ya existe en la base' });
        } else {
          results.push({ id, name, status: 'error', message: msg });
        }
      } catch (e: any) {
        const msg = formatAmplifyError(e);
        if (isDuplicateLikeError(msg)) {
          results.push({ id, name, status: 'existente', message: 'Ya existe en la base' });
        } else {
          results.push({ id, name, status: 'error', message: msg });
        }
      }
    }

    return { success: true, results };
  } catch (e) {
    return { success: false, results: [], error: formatAmplifyError(e) };
  }
}
