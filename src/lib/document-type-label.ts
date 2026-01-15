export type DocumentTypeLike = {
  name?: string | null;
  printTemplate?: string | null;
  code?: string | null;
  languageKey?: string | null;
};

const byPrintTemplate: Record<string, string> = {
  Proforma: "Proforma",
  InventoryCount: "Conteo de inventario",
  Invoice: "Factura",
  Refund: "Devolución",
  LossAndDamage: "Merma / Daño",
  Purchase: "Compra",
  StockReturn: "Devolución de stock",
};

const byName: Record<string, string> = {
  Proforma: "Proforma",
  "Inventory Count": "Conteo de inventario",
  Sales: "Venta",
  Invoice: "Factura",
  Refund: "Devolución",
  "Loss And Damage": "Merma / Daño",
  Purchase: "Compra",
  "Stock Return": "Devolución de stock",
};

export function documentTypeLabelEs(dt: DocumentTypeLike): string {
  const pt = String(dt?.printTemplate ?? "").trim();
  if (pt.length > 0 && byPrintTemplate[pt]) return byPrintTemplate[pt];

  const name = String(dt?.name ?? "").trim();
  if (name.length > 0 && byName[name]) return byName[name];

  // Fallback: try to use languageKey (some migrations use dotted keys)
  const lk = String(dt?.languageKey ?? "").trim();
  if (lk.length > 0) return lk;

  return name || pt || "Documento";
}

export function documentTemplateKey(dt: DocumentTypeLike): string {
  const pt = String(dt?.printTemplate ?? "").trim();
  if (pt.length > 0) return pt;
  return String(dt?.name ?? "").trim();
}
