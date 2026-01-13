'use server';

import { amplifyClient } from '@/lib/amplify-config';
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
  if (!ALLOWED_TABLES.includes(tableName.toLowerCase())) {
    console.error(`Acceso denegado: La tabla '${tableName}' no está permitida.`);
    throw new Error('Tabla no permitida');
  }

  // Mapeo de relaciones a incluir por tabla (según resource.ts)
  const RELATIONS: Record<string, string[]> = {
    user: ['documents', 'payments', 'startingCashes', 'posOrders', 'sessionConfig'],
    company: [],
    country: [],
    currency: [],
    warehouse: ['stocks', 'documents', 'documentTypes'],
    productgroup: ['products'],
    product: ['productGroup', 'barcodes', 'stocks', 'stockControls', 'documentItems', 'comments', 'taxes', 'kardexEntries', 'kardexHistories'],
    barcode: ['product'],
    stock: ['product', 'warehouse'],
    stockcontrol: ['product'],
    productcomment: ['product'],
    kardex: ['product'],
    kardexhistory: ['product'],
    customer: ['documents', 'discounts', 'loyaltyCards'],
    customerdiscount: ['customer'],
    loyaltycard: ['customer'],
    documentcategory: ['documentTypes'],
    documenttype: ['warehouse', 'category', 'documents'],
    document: ['user', 'customer', 'warehouse', 'documentType', 'items', 'payments', 'itemPriceViews'],
    documentitem: ['priceView', 'document', 'product', 'taxes'],
    documentitempriceview: ['documentItem', 'document'],
    tax: ['productTaxes', 'documentItemTaxes'],
    producttax: ['product', 'tax'],
    documentitemtax: ['documentItem', 'tax'],
    paymenttype: ['payments'],
    payment: ['document', 'paymentType', 'user'],
    posorder: ['user', 'items'],
    posorderitem: ['posOrder'],
    startingcash: ['user'],
    sessionconfig: ['user'],
    // Otros modelos sin relaciones relevantes
    applicationproperty: [],
    counter: [],
    zreport: [],
    template: [],
    applicationsettings: [],
    auditlog: [],
    documentnumber: [],
    // Agrega aquí más si es necesario
  };

  // Mapeo de nombres de tabla a modelo Amplify (por si hay diferencias)
  const MODEL_MAP: Record<string, string> = {
    user: 'User',
    company: 'Company',
    country: 'Country',
    currency: 'Currency',
    warehouse: 'Warehouse',
    productgroup: 'ProductGroup',
    product: 'Product',
    barcode: 'Barcode',
    stock: 'Stock',
    stockcontrol: 'StockControl',
    productcomment: 'ProductComment',
    kardex: 'Kardex',
    kardexhistory: 'KardexHistory',
    customer: 'Customer',
    customerdiscount: 'CustomerDiscount',
    loyaltycard: 'LoyaltyCard',
    documentcategory: 'DocumentCategory',
    documenttype: 'DocumentType',
    document: 'Document',
    documentitem: 'DocumentItem',
    documentitempriceview: 'DocumentItemPriceView',
    tax: 'Tax',
    producttax: 'ProductTax',
    documentitemtax: 'DocumentItemTax',
    paymenttype: 'PaymentType',
    payment: 'Payment',
    posorder: 'PosOrder',
    posorderitem: 'PosOrderItem',
    startingcash: 'StartingCash',
    sessionconfig: 'SessionConfig',
    applicationproperty: 'ApplicationProperty',
    counter: 'Counter',
    zreport: 'ZReport',
    template: 'Template',
    applicationsettings: 'ApplicationSettings',
    auditlog: 'AuditLog',
    documentnumber: 'DocumentNumber',
    // Otros modelos si es necesario
  };

  try {
    const modelName = MODEL_MAP[tableName.toLowerCase()] || tableName;
    const include = RELATIONS[tableName.toLowerCase()] || [];

    const modelsAny = amplifyClient.models as unknown as Record<string, any>;
    const model = modelsAny[modelName];
    if (!model || typeof model.list !== 'function') {
      return { error: `Model not found or unsupported: ${modelName}` };
    }

    // Consulta a Amplify DataStore (Data) usando amplifyClient
    // El método es: amplifyClient.models[modelName].list({ include })
    // Si no hay relaciones, no se pasa include
    let result;
    if (include.length > 0) {
      result = await model.list({ include });
    } else {
      result = await model.list();
    }

    // result.items es el array de datos
    const data = result.items || [];
    // Determinar columnas dinámicamente del primer registro
    let columns: string[] = [];
    if (data.length > 0) {
      // Unir claves propias y de relaciones (solo primer nivel)
      const baseKeys = Object.keys(data[0] || {});
      // Si hay relaciones, agregar claves de primer nivel de los objetos relacionados
      include.forEach((rel) => {
        if (data[0][rel] && typeof data[0][rel] === 'object') {
          const relKeys = Object.keys(data[0][rel] || {}).map((k) => `${rel}.${k}`);
          columns.push(...relKeys);
        }
      });
      columns = [...baseKeys, ...columns];
    }
    return { data, columns };
  } catch (error: any) {
    console.error(`Error al obtener datos de la tabla ${tableName}:`, error);
    return { error: error.message || 'Error loading table data.' };
  }
}
