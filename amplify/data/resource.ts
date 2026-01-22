import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // 1. USUARIOS
  User: a.model({
    userId: a.integer().required(), 
    username: a.string().required(),
    password: a.string().required(),
    accessLevel: a.integer().default(0),
    firstName: a.string(),
    lastName: a.string(),
    email: a.email(),
    isEnabled: a.boolean().default(true),
    // Relaciones
    documents: a.hasMany('Document', 'userId'),
    payments: a.hasMany('Payment', 'userId'),
    startingCashes: a.hasMany('StartingCash', 'userId'),
    posOrders: a.hasMany('PosOrder', 'userId'),
    sessionConfig: a.hasOne('SessionConfig', 'userId'), 
  }).identifier(['userId']).authorization((allow) => [allow.publicApiKey()]),

  // 2. EMPRESA Y MAESTROS
  Company: a.model({
    idCompany: a.integer().required(),
    name: a.string().required(),
    address: a.string(),
    postalCode: a.string(),
    city: a.string(),
    countryId: a.integer(),
    taxNumber: a.string(),
    email: a.string(),
    phoneNumber: a.string(),
    logo: a.string(),
    bankAccountNumber: a.string(),
    bankDetails: a.string(),
    streetName: a.string(),
    additionalStreetName: a.string(),
    buildingNumber: a.string(),
    plotIdentification: a.string(),
    citySubdivisionName: a.string(),
    countrySubentity: a.string(),
  }).identifier(['idCompany']).authorization((allow) => [allow.publicApiKey()]),

  Country: a.model({
    idCountry: a.integer().required(),
    name: a.string().required(),
    code: a.string(),
  }).identifier(['idCountry']).authorization((allow) => [allow.publicApiKey()]),

  Currency: a.model({
    idCurrency: a.integer().required(),
    name: a.string().required(),
    code: a.string(),
  }).identifier(['idCurrency']).authorization((allow) => [allow.publicApiKey()]),

  // 3. ALMACENES Y PRODUCTOS
  Warehouse: a.model({
    idWarehouse: a.integer().required(),
    name: a.string().required(),
    stocks: a.hasMany('Stock', 'warehouseId'),
    documents: a.hasMany('Document', 'warehouseId'),
    documentTypes: a.hasMany('DocumentType', 'warehouseId'),
    kardexEntries: a.hasMany('Kardex', 'warehouseId'),
  }).identifier(['idWarehouse']).authorization((allow) => [allow.publicApiKey()]),

  ProductGroup: a.model({
    idProductGroup: a.integer().required(),
    name: a.string().required(),
    parentGroupId: a.integer(),
    color: a.string(),
    image: a.string(),
    rank: a.integer(),
    products: a.hasMany('Product', 'productGroupId'),
  }).identifier(['idProductGroup']).authorization((allow) => [allow.publicApiKey()]),

  Product: a.model({
    idProduct: a.integer().required(),
    name: a.string().required(),
    code: a.string(),
    plu: a.integer(),
    measurementUnit: a.string(),
    price: a.float().default(0),
    isTaxInclusivePrice: a.boolean().default(true),
    currencyId: a.integer(),
    isPriceChangeAllowed: a.boolean().default(false),
    isService: a.boolean().default(false),
    isUsingDefaultQuantity: a.boolean().default(true),
    isEnabled: a.boolean().default(true),
    description: a.string(),
    cost: a.float().default(0),
    markup: a.float().default(0),
    image: a.string(),
    color: a.string(),
    ageRestriction: a.float(),
    lastPurchasePrice: a.float().default(0),
    rank: a.float(),
    productGroupId: a.integer(),
    productGroup: a.belongsTo('ProductGroup', 'productGroupId'),
    barcodes: a.hasMany('Barcode', 'productId'),
    stocks: a.hasMany('Stock', 'productId'),
    stockControls: a.hasMany('StockControl', 'productId'),
    documentItems: a.hasMany('DocumentItem', 'productId'),
    comments: a.hasMany('ProductComment', 'productId'),
    taxes: a.hasMany('ProductTax', 'productId'),
    kardexEntries: a.hasMany('Kardex', 'productId'),
    kardexHistories: a.hasMany('KardexHistory', 'productId'),
  }).identifier(['idProduct']).authorization((allow) => [allow.publicApiKey()]),

  
  Barcode: a.model({
    productId: a.integer().required(),
    value: a.string().required(),
    product: a.belongsTo('Product', 'productId'),
  }).identifier(['productId', 'value']).authorization((allow) => [allow.publicApiKey()]),

  Stock: a.model({
    productId: a.integer().required(),
    warehouseId: a.integer().required(),
    quantity: a.float().required(),
    product: a.belongsTo('Product', 'productId'),
    warehouse: a.belongsTo('Warehouse', 'warehouseId'),
  }).identifier(['productId', 'warehouseId']).authorization((allow) => [allow.publicApiKey()]),

  StockControl: a.model({
    stockControlId: a.integer().required(),
    productId: a.integer().required(),
    customerId: a.integer(),
    reorderPoint: a.float().default(0),
    preferredQuantity: a.float().default(0),
    isLowStockWarningEnabled: a.boolean().default(true),
    lowStockWarningQuantity: a.float().default(0),
    product: a.belongsTo('Product', 'productId'),
  })
    .identifier(['stockControlId'])
    .secondaryIndexes((index) => [index('productId').name('byProductId')])
    .authorization((allow) => [allow.publicApiKey()]),

  ProductComment: a.model({
    commentId: a.integer().required(),
    productId: a.integer().required(),
    comment: a.string().required(),
    product: a.belongsTo('Product', 'productId'),
  }).identifier(['commentId']).authorization((allow) => [allow.publicApiKey()]),

  // 5. KARDEX
  Kardex: a.model({
    kardexId: a.integer().required(),
    productId: a.integer().required(),
    date: a.datetime().required(),
    documentId: a.integer(),
    documentItemId: a.integer(),
    documentNumber: a.string(),
    warehouseId: a.integer(),
    type: a.string().required(),
    quantity: a.float().required(),
    balance: a.float().required(),
    unitCost: a.float(),
    totalCost: a.float(),
    unitPrice: a.float(),
    totalPrice: a.float(),
    totalPriceAfterDiscount: a.float(),
    note: a.string(),
    userId: a.integer(),
    product: a.belongsTo('Product', 'productId'),
    document: a.belongsTo('Document', 'documentId'),
    documentItem: a.belongsTo('DocumentItem', 'documentItemId'),
    warehouse: a.belongsTo('Warehouse', 'warehouseId'),
  })
    .identifier(['kardexId'])
    .secondaryIndexes((index) => [
      index('productId').name('byProductId'),
      index('documentId').name('byDocumentId'),
      index('warehouseId').name('byWarehouseId'),
    ])
    .authorization((allow) => [allow.publicApiKey()]),

  KardexHistory: a.model({
    kardexHistoryId: a.integer().required(),
    kardexId: a.integer().required(),
    productId: a.integer().required(),
    previousBalance: a.float(),
    newBalance: a.float(),
    modifiedBy: a.integer(),
    modifiedDate: a.datetime().required(),
    reason: a.string(),
    product: a.belongsTo('Product', 'productId'),
  }).identifier(['kardexHistoryId']).authorization((allow) => [allow.publicApiKey()]),

  // 6. PROVEEDORES (modelo legado: Customer)
  // NOTE: En InventoryTW, este modelo se usa exclusivamente para proveedores.
  Customer: a.model({
    idCustomer: a.integer().required(),
    code: a.string(),
    name: a.string().required(),
    taxNumber: a.string(),
    address: a.string(),
    postalCode: a.string(),
    city: a.string(),
    countryId: a.integer(),
    email: a.string(),
    phoneNumber: a.string(),
    isEnabled: a.boolean().default(true),
    isCustomer: a.boolean().default(true),
    isSupplier: a.boolean().default(true),
    dueDatePeriod: a.integer().default(0),
    isTaxExempt: a.boolean().default(false),
    documents: a.hasMany('Document', 'customerId'),
    discounts: a.hasMany('CustomerDiscount', 'customerId'),
    loyaltyCards: a.hasMany('LoyaltyCard', 'customerId'),
  }).identifier(['idCustomer']).authorization((allow) => [allow.publicApiKey()]),

  // 6b. CLIENTES (ventas)
  Client: a.model({
    idClient: a.integer().required(),
    name: a.string().required(),
    taxNumber: a.string(),
    email: a.string(),
    phoneNumber: a.string(),
    address: a.string(),
    city: a.string(),
    isEnabled: a.boolean().default(true),
    notes: a.string(),
    documents: a.hasMany('Document', 'clientId'),
  }).identifier(['idClient']).authorization((allow) => [allow.publicApiKey()]),

  CustomerDiscount: a.model({
    customerDiscountId: a.integer().required(),
    customerId: a.integer().required(),
    type: a.integer().default(0),
    uid: a.integer(),
    value: a.float().default(0),
    customer: a.belongsTo('Customer', 'customerId'),
  }).identifier(['customerDiscountId']).authorization((allow) => [allow.publicApiKey()]),

  LoyaltyCard: a.model({
    cardNumber: a.string().required(),
    customerId: a.integer().required(),
    customer: a.belongsTo('Customer', 'customerId'),
  }).identifier(['cardNumber']).authorization((allow) => [allow.publicApiKey()]),

  // 7. DOCUMENTOS
  DocumentCategory: a.model({
    idDocumentCategory: a.integer().required(),
    name: a.string().required(),
    languageKey: a.string(),
    documentTypes: a.hasMany('DocumentType', 'documentCategoryId'),
  }).identifier(['idDocumentCategory']).authorization((allow) => [allow.publicApiKey()]),

  DocumentType: a.model({
    documentTypeId: a.integer().required(),
    name: a.string().required(),
    code: a.string().required(),
    documentCategoryId: a.integer().required(),
    warehouseId: a.integer().required(),
    stockDirection: a.integer().default(0),
    editorType: a.integer().default(0),
    printTemplate: a.string(),
    priceType: a.integer().default(0),
    languageKey: a.string(),
    warehouse: a.belongsTo('Warehouse', 'warehouseId'),
    category: a.belongsTo('DocumentCategory', 'documentCategoryId'),
    documents: a.hasMany('Document', 'documentTypeId'),
  }).identifier(['documentTypeId']).authorization((allow) => [allow.publicApiKey()]),

  Document: a.model({
    documentId: a.integer().required(),
    number: a.string().required(),
    userId: a.integer().required(),
    customerId: a.integer(),
    clientId: a.integer(),
    // Snapshot for traceability (free-text client name, e.g. POS)
    clientNameSnapshot: a.string(),
    orderNumber: a.string(),
    date: a.date().required(),
    stockDate: a.datetime().required(),
    total: a.float().required(),
    isClockedOut: a.boolean().default(false),
    documentTypeId: a.integer().required(),
    warehouseId: a.integer().required(),
    // Optional idempotency key for safe retries / double-submits (e.g. POS)
    idempotencyKey: a.string(),
    referenceDocumentNumber: a.string(),
    internalNote: a.string(),
    note: a.string(),
    dueDate: a.date(),
    discount: a.float().default(0),
    discountType: a.integer().default(0),
    paidStatus: a.integer().default(0),
    discountApplyRule: a.integer().default(0),
    serviceType: a.integer().default(0),
    user: a.belongsTo('User', 'userId'),
    customer: a.belongsTo('Customer', 'customerId'),
    client: a.belongsTo('Client', 'clientId'),
    warehouse: a.belongsTo('Warehouse', 'warehouseId'),
    documentType: a.belongsTo('DocumentType', 'documentTypeId'),
    items: a.hasMany('DocumentItem', 'documentId'),
    payments: a.hasMany('Payment', 'documentId'),
    itemPriceViews: a.hasMany('DocumentItemPriceView', 'documentId'),
    kardexEntries: a.hasMany('Kardex', 'documentId'),
  })
    .identifier(['documentId'])
    .secondaryIndexes((index) => [index('idempotencyKey').name('byIdempotencyKey')])
    .authorization((allow) => [allow.publicApiKey()]),

  DocumentItem: a.model({
    documentId: a.integer().required(),
    productId: a.integer().required(),
    // Snapshots for traceability (avoid depending on current Product master data)
    productNameSnapshot: a.string(),
    productCodeSnapshot: a.string(),
    measurementUnitSnapshot: a.string(),
    barcodeSnapshot: a.string(),
    quantity: a.float().required(),
    expectedQuantity: a.float().default(0),
    priceBeforeTax: a.float().default(0),
    price: a.float().required(),
    discount: a.float().default(0),
    discountType: a.integer().default(0),
    productCost: a.float().default(0),
    priceBeforeTaxAfterDiscount: a.float().default(0),
    priceAfterDiscount: a.float().default(0),
    total: a.float().default(0),
    totalAfterDocumentDiscount: a.float().default(0),
    discountApplyRule: a.integer().default(0),
    priceView: a.hasOne('DocumentItemPriceView', 'documentItemId'),
    document: a.belongsTo('Document', 'documentId'),
    product: a.belongsTo('Product', 'productId'),
    taxes: a.hasMany('DocumentItemTax', 'documentItemId'),
    kardexEntries: a.hasMany('Kardex', 'documentItemId'),
    documentItemId: a.integer().required() 
  }).identifier(['documentItemId']).authorization((allow) => [allow.publicApiKey()]),

  // VISTA: DocumentItemPriceView
  DocumentItemPriceView: a.model({
    documentItemId: a.integer().required(),
    price: a.float().required(),
    documentId: a.integer().required(),
    // Relaciones
    documentItem: a.belongsTo('DocumentItem', 'documentItemId'),
    document: a.belongsTo('Document', 'documentId'),
  }).identifier(['documentItemId']).authorization((allow) => [allow.publicApiKey()]),

  // 8. IMPUESTOS
  Tax: a.model({
    idTax: a.integer().required(),
    name: a.string().required(),
    rate: a.float().required(),
    code: a.string(),
    isFixed: a.boolean().default(false),
    isTaxOnTotal: a.boolean().default(false),
    isEnabled: a.boolean().default(true),
    productTaxes: a.hasMany('ProductTax', 'taxId'),
    documentItemTaxes: a.hasMany('DocumentItemTax', 'taxId'),
  }).identifier(['idTax']).authorization((allow) => [allow.publicApiKey()]),

  ProductTax: a.model({
    productId: a.integer().required(),
    taxId: a.integer().required(),
    product: a.belongsTo('Product', 'productId'),
    tax: a.belongsTo('Tax', 'taxId'),
  }).identifier(['productId', 'taxId']).authorization((allow) => [allow.publicApiKey()]),

  DocumentItemTax: a.model({
    documentItemId: a.integer().required(),
    taxId: a.integer().required(),
    amount: a.float().required(),
    documentItem: a.belongsTo('DocumentItem', 'documentItemId'),
    tax: a.belongsTo('Tax', 'taxId'),
  }).identifier(['documentItemId', 'taxId']).authorization((allow) => [allow.publicApiKey()]),

  // 9. PAGOS Y POS
  PaymentType: a.model({
    paymentTypeId: a.integer().required(),
    name: a.string().required(),
    code: a.string(),
    isCustomerRequired: a.boolean().default(false),
    isFiscal: a.boolean().default(true),
    isSlipRequired: a.boolean().default(false),
    isChangeAllowed: a.boolean().default(true),
    ordinal: a.integer().default(0),
    isEnabled: a.boolean().default(true),
    isQuickPayment: a.boolean().default(true),
    openCashDrawer: a.boolean().default(true),
    shortcutKey: a.string(),
    markAsPaid: a.boolean().default(true),
    payments: a.hasMany('Payment', 'paymentTypeId'),
  }).identifier(['paymentTypeId']).authorization((allow) => [allow.publicApiKey()]),

  Payment: a.model({
    paymentId: a.integer().required(),
    documentId: a.integer().required(),
    paymentTypeId: a.integer().required(),
    amount: a.float().required(),
    date: a.date(),
    userId: a.integer(),
    zReportId: a.integer(),
    document: a.belongsTo('Document', 'documentId'),
    paymentType: a.belongsTo('PaymentType', 'paymentTypeId'),
    user: a.belongsTo('User', 'userId'),
  }).identifier(['paymentId']).authorization((allow) => [allow.publicApiKey()]),

  PosOrder: a.model({
    posOrderId: a.integer().required(),
    userId: a.integer().required(),
    number: a.string().required(),
    discount: a.float().default(0),
    discountType: a.integer().default(0),
    total: a.float(),
    customerId: a.integer(),
    serviceType: a.integer().default(0),
    user: a.belongsTo('User', 'userId'),
    items: a.hasMany('PosOrderItem', 'posOrderId'),
  }).identifier(['posOrderId']).authorization((allow) => [allow.publicApiKey()]),

  PosOrderItem: a.model({
    posOrderId: a.integer().required(),
    productId: a.integer().required(),
    roundNumber: a.integer().default(0),
    quantity: a.float().required(),
    price: a.float().required(),
    isLocked: a.boolean().default(false),
    discount: a.float().default(0),
    discountType: a.integer().default(0),
    isFeatured: a.boolean().default(false),
    voidedBy: a.integer(),
    comment: a.string(),
    dateCreated: a.date().required(),
    bundle: a.string(),
    discountAppliedType: a.integer().default(0),
    posOrder: a.belongsTo('PosOrder', 'posOrderId'),
  }).identifier(['posOrderId', 'productId']).authorization((allow) => [allow.publicApiKey()]),

  // 10. OTROS
  StartingCash: a.model({
    startingCashId: a.integer().required(),
    userId: a.integer().required(),
    amount: a.float().required(),
    description: a.string(),
    startingCashType: a.integer().default(0),
    zReportNumber: a.integer(),
    user: a.belongsTo('User', 'userId'),
  }).identifier(['startingCashId']).authorization((allow) => [allow.publicApiKey()]),

  Counter: a.model({
    name: a.string().required(),
    value: a.integer().required(),
  }).identifier(['name']).authorization((allow) => [allow.publicApiKey()]),

  ApplicationProperty: a.model({
    name: a.string().required(),
    value: a.string(),
  }).identifier(['name']).authorization((allow) => [allow.publicApiKey()]),

  ZReport: a.model({
    number: a.integer().required(),
    fromDocumentId: a.integer().required(),
    toDocumentId: a.integer().required(),
    dateCreated: a.datetime().required(),
  }).identifier(['number']).authorization((allow) => [allow.publicApiKey()]),

  Template: a.model({
    name: a.string().required(),
    value: a.string().required(),
  }).identifier(['name']).authorization((allow) => [allow.publicApiKey()]),

  SessionConfig: a.model({
    userId: a.integer().required(),
    accessLevel: a.integer().required(),
    firstName: a.string(),
    lastName: a.string(),
    email: a.string(),
    loginTime: a.datetime().required(),
    lastActivityTime: a.datetime(),
    isActive: a.boolean().default(true),
    sessionToken: a.string(),
    // CORRECCIÓN: Relación inversa añadida
    user: a.belongsTo('User', 'userId'),
  }).identifier(['userId']).authorization((allow) => [allow.publicApiKey()]),

  ApplicationSettings: a.model({
    companyId: a.integer().required(),
    organizationName: a.string(),
    organizationLogo: a.string(),
    primaryColor: a.string().default('#1f2937'),
    currencySymbol: a.string().default('$'),
    dateFormat: a.string().default('YYYY-MM-DD'),
    timeFormat: a.string().default('HH:mm:ss'),
    taxPercentage: a.float().default(19),
    allowNegativeStock: a.boolean().default(false),
    defaultWarehouseId: a.integer(),
    lastModifiedBy: a.integer(),
    lastModifiedDate: a.datetime(),
  }).identifier(['companyId']).authorization((allow) => [allow.publicApiKey()]),

  AuditLog: a.model({
    logId: a.id().required(),
    userId: a.integer().required(),
    action: a.string().required(),
    tableName: a.string().required(),
    recordId: a.integer().required(),
    oldValues: a.string(),
    newValues: a.string(),
    timestamp: a.datetime().required(),
    ipAddress: a.string(),
    userAgent: a.string(),
  }).authorization((allow) => [allow.publicApiKey()]),

  DocumentNumber: a.model({
    documentTypeId: a.integer().required(),
    warehouseId: a.integer().required(),
    year: a.integer().required(),
    month: a.integer().required(),
    sequence: a.integer().required(),
    lastNumber: a.integer().required(),
  }).identifier(['documentTypeId', 'warehouseId', 'year']).authorization((allow) => [allow.publicApiKey()]),

  // 11. IMPRESIÓN DE ETIQUETAS (SOLICITUDES PERSISTENTES)
  PrintLabelRequest: a.model({
    requestId: a.id().required(),
    requestedAt: a.datetime().required(),
    status: a.string().default('PENDING'),
    items: a.hasMany('PrintLabelRequestItem', 'requestId'),
  })
    .identifier(['requestId'])
    .secondaryIndexes((index) => [index('status').name('byStatus')])
    .authorization((allow) => [allow.publicApiKey()]),

  PrintLabelRequestItem: a.model({
    requestItemId: a.id().required(),
    requestId: a.id().required(),
    productId: a.integer().required(),
    qty: a.integer().required(),
    name: a.string().required(),
    reference: a.string(),
    measurementUnit: a.string(),
    productCreatedAt: a.string(),
    primaryBarcode: a.string().required(),
    request: a.belongsTo('PrintLabelRequest', 'requestId'),
  })
    .identifier(['requestItemId'])
    .secondaryIndexes((index) => [index('requestId').name('byRequestId')])
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
  },
});