import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  User: a.model({
    username: a.string().required(),
    password: a.string().required(), // Reminder: Never store plaintext passwords
    firstName: a.string(),
    lastName: a.string(),
    email: a.email().required(),
    accessLevel: a.integer().default(0), // 0: Cashier, 1: Admin
    // If you want to link users to documents in the future
    // documents: a.hasMany('Document', 'userId'),
  })
  .authorization((allow) => [allow.publicApiKey()]), // Adjust auth rules as needed

  Product: a.model({
    name: a.string().required(),
    code: a.string(),
    plu: a.integer(),
    price: a.float().required(),
    cost: a.float(),
    isService: a.boolean().default(false),
    measurementUnit: a.string(),
    image: a.url(),
    description: a.string(),
    productGroupId: a.id(),
    group: a.belongsTo('ProductGroup', 'productGroupId'),
    barcodes: a.hasMany('Barcode', 'productId'),
    stockLevels: a.hasMany('Stock', 'productId'),
  })
  .authorization((allow) => [allow.publicApiKey()]),

  ProductGroup: a.model({
    name: a.string().required(),
    parentGroupId: a.id(),
    products: a.hasMany('Product', 'productGroupId'),
    parent: a.belongsTo('ProductGroup', 'parentGroupId'),
    children: a.hasMany('ProductGroup', 'parentGroupId'),
  })
  .authorization((allow) => [allow.publicApiKey()]),

  Warehouse: a.model({
    name: a.string().required(),
    stockLevels: a.hasMany('Stock', 'warehouseId'),
  })
  .authorization((allow) => [allow.publicApiKey()]),

  Stock: a.model({
    quantity: a.float().required(),
    productId: a.id().required(),
    warehouseId: a.id().required(),
    product: a.belongsTo('Product', 'productId'),
    warehouse: a.belongsTo('Warehouse', 'warehouseId'),
  })
  .authorization((allow) => [allow.publicApiKey()]),

  Barcode: a.model({
    value: a.string().required(),
    productId: a.id().required(),
    product: a.belongsTo('Product', 'productId'),
  })
  .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    }
  },
});