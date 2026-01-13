/**
 * Tipos generados para coincidir con el esquema de Amplify y los datos históricos.
 */

export type User = {
  id?: string;
  username: string;
  password?: string;
  accessLevel: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  isEnabled: boolean;
  avatar?: string;
};

export type Notification = {
  id: string;
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  location?: string;
  category?: string;
  dateAdded?: string;
  manufacturer?: string;
  status?: string;
};

// Legacy inventory table row used by the current inventory UI
export type StockInfo = {
  id: number;
  name: string;
  code?: string;
  measurementunit?: string;
  quantity?: number;
  price?: number;
  dateupdated?: string;
  warehousename?: string;
  taxes?: string;
  description?: string;
  cost?: number;
  markup?: number;
  lastpurchaseprice?: number;
  currencycode?: string;
  currencyname?: string;
  productgroupid?: number;
  productgroupname?: string;
  reorderpoint?: number;
  lowstockwarningquantity?: number;
  islowstockwarningenabled?: boolean;
  isenabled?: boolean;
  istaxinclusiveprice?: boolean;
  color?: string;
};

export type Product = {
  id: string;
  name: string;
  code?: string;
  plu?: number;
  measurementUnit?: string;
  price: number;
  cost: number;
  markup?: number;
  lastPurchasePrice?: number;
  productGroupId?: string;
  totalStock?: number; // Calculado o desde Stock
};

export type ProductGroup = {
  id: string;
  name: string;
  parentGroupId?: string;
  color?: string;
  image?: string;
};

export type Warehouse = {
  id: string;
  name: string;
};

export type Stock = {
  id?: string;
  productId: string;
  warehouseId: string;
  quantity: number;
};

export type KardexEntry = {
  id?: string;
  productId: string;
  date: string;
  documentId?: string;
  documentNumber?: string;
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  quantity: number;
  balance: number;
  unitCost?: number;
  totalCost?: number;
  note?: string;
  userId?: string;
};

export type Document = {
  id?: string;
  number: string;
  userId: string;
  customerId?: string;
  date: string;
  stockDate: string;
  total: number;
  documentTypeId: string;
  warehouseId: string;
  referenceDocumentNumber?: string;
  items?: DocumentItem[];
};

export type DocumentItem = {
  id?: string;
  documentId: string;
  productId: string;
  quantity: number;
  price: number;
  total: number;
  productCost?: number;
};

export type Customer = {
  id: string;
  name: string;
  taxNumber?: string;
  email?: string;
  phoneNumber?: string;
  isCustomer: boolean;
  isSupplier: boolean;
};

export type Tax = {
  id: string;
  name: string;
  rate: number;
  isFixed: boolean;
};
