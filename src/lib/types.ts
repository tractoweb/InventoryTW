export type InventoryItem = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  location: string;
  category: "Electronics" | "Furniture" | "Office Supplies" | "Software";
  dateAdded: string; // ISO 8601 string
  manufacturer: string;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  expiryDate?: string; // ISO 8601 string
};

export type Notification = {
  id: string;
  title: string;
  description: string;
  read: boolean;
  createdAt: string; // ISO 8601 string
};

export type User = {
  name: string;
  email: string;
  avatar: string;
};

// Tipo para el inventario de productos desde la BD
export type ProductInventory = {
  id: number;
  name: string;
  code: string | null;
  measurementunit: string | null;
  price: number;
  totalstock: number | null;
  dateupdated: string; // ISO 8601 string
};

// Tipo para la información de stock desde la BD
export type StockInfo = {
  id: number;
  name: string;
  code: string | null;
  measurementunit: string | null;
  quantity: number;
  price: number;
  cost: number;
  datecreated: string; // ISO 8601 string
  dateupdated: string; // ISO 8601 string
  warehousename: string;
};
