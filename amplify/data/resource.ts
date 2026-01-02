import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Product: a.model({
    // Fields
    name: a.string().required(),
    code: a.string(),
    plu: a.integer(),
    price: a.float().required(),
    cost: a.float(),
    isService: a.boolean().default(false),
    measurementUnit: a.string(),
    image: a.url(),
    description: a.string(),

    // Relationship fields (foreign keys)
    productGroupId: a.id(), 

    // Relationships
    group: a.belongsTo('ProductGroup', 'productGroupId'),
    barcodes: a.hasMany('Barcode', 'productId'),
    stockLevels: a.hasMany('Stock', 'productId'),
  })
  .identifier(['id']) // Using the default 'id' as the primary identifier
  .authorization(allow => [allow.publicApiKey()]),

  ProductGroup: a.model({
    // Fields
    name: a.string().required(),

    // Relationship fields
    parentProductGroupId: a.id(),

    // Relationships
    products: a.hasMany('Product', 'productGroupId'),
    parent: a.belongsTo('ProductGroup', 'parentProductGroupId'),
    children: a.hasMany('ProductGroup', 'parentProductGroupId'),
  })
  .identifier(['id'])
  .authorization(allow => [allow.publicApiKey()]),

  Warehouse: a.model({
    // Fields
    name: a.string().required(),

    // Relationships
    stockLevels: a.hasMany('Stock', 'warehouseId'),
  })
  .identifier(['id'])
  .authorization(allow => [allow.publicApiKey()]),

  Stock: a.model({
    // Fields
    quantity: a.float().required(),

    // Relationship fields
    productId: a.id().required(),
    warehouseId: a.id().required(),

    // Relationships
    product: a.belongsTo('Product', 'productId'),
    warehouse: a.belongsTo('Warehouse', 'warehouseId'),
  })
  .identifier(['id'])
  .authorization(allow => [allow.publicApiKey()]),

  Barcode: a.model({
    // Fields
    value: a.string().required(),

    // Relationship fields
    productId: a.id().required(),

    // Relationships
    product: a.belongsTo('Product', 'productId'),
  })
  .identifier(['id'])
  .authorization(allow => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { // Corrected property name and structure
      expiresInDays: 30,
    }
  },
});
