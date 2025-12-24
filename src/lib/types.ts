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
