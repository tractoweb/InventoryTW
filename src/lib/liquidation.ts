export type LiquidationFreightRate = {
  id: string;
  name: string;
  cost: number;
};

export type LiquidationConfig = {
  ivaPercentage: number;
  ivaIncludedInCost: boolean;
  discountsEnabled: boolean;
  useMultipleFreights: boolean;
  freightRates: LiquidationFreightRate[];
};

export type LiquidationLineInput = {
  id: string;
  productId?: number;
  name?: string;
  quantity: number;
  totalCost: number;
  discountPercentage: number;
  marginPercentage: number;
  freightId: string;
};

export type LiquidationLineOutput = LiquidationLineInput & {
  unitCost: number;
  unitDiscount: number;
  unitCostAfterDiscount: number;
  unitIVA: number;
  unitCostWithIVA: number;
  unitFreight: number;
  unitFinalCost: number;
  unitSalePrice: number;
  totalDiscount: number;
  totalIVA: number;
  totalFreight: number;
  totalFinalCost: number;
  totalSalePrice: number;
  profit: number;
};

export type LiquidationTotals = {
  totalPurchaseCost: number;
  totalDiscount: number;
  totalIVA: number;
  totalFreight: number;
  totalFinalCost: number;
  totalSalePrice: number;
  totalProfit: number;
  profitMarginPercentage: number;
};

export type LiquidationResult = {
  lines: LiquidationLineOutput[];
  totals: LiquidationTotals;
};

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function safeDiv(num: number, den: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
  return num / den;
}

export function computeLiquidation(config: LiquidationConfig, lines: LiquidationLineInput[]): LiquidationResult {
  const ivaPercentage = n(config.ivaPercentage);
  const ivaIncludedInCost = Boolean(config.ivaIncludedInCost);
  const discountsEnabled = Boolean(config.discountsEnabled);
  const useMultipleFreights = Boolean(config.useMultipleFreights);

  const normalizedRates = (config.freightRates ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? r.id),
    cost: n(r.cost),
  }));

  // Mirror the existing calculator behavior:
  // - If single freight: distribute by number of product lines, then by quantity.
  // - If multiple freights: distribute by number of product lines assigned to that freight, then by quantity.
  const freightPerLineTotal = new Map<string, number>();
  if (!useMultipleFreights) {
    const total = normalizedRates[0]?.cost ?? 0;
    const lineCount = Math.max(1, lines.length);
    for (const line of lines) freightPerLineTotal.set(line.id, safeDiv(total, lineCount));
  } else {
    const byFreight = new Map<string, LiquidationLineInput[]>();
    for (const line of lines) {
      const fid = String(line.freightId ?? "");
      const arr = byFreight.get(fid) ?? [];
      arr.push(line);
      byFreight.set(fid, arr);
    }

    for (const [freightId, groupLines] of byFreight.entries()) {
      const cost = normalizedRates.find((r) => r.id === freightId)?.cost ?? 0;
      const count = Math.max(1, groupLines.length);
      for (const line of groupLines) freightPerLineTotal.set(line.id, safeDiv(cost, count));
    }
  }

  const outLines: LiquidationLineOutput[] = lines.map((line) => {
    const quantity = n(line.quantity);
    const totalCost = n(line.totalCost);

    const unitCost = quantity > 0 ? safeDiv(totalCost, quantity) : 0;

    const discountPct = discountsEnabled ? Math.max(0, n(line.discountPercentage)) : 0;
    const unitDiscount = (unitCost * discountPct) / 100;
    const unitCostAfterDiscount = Math.max(0, unitCost - unitDiscount);

    const ivaPct = Math.max(0, ivaPercentage);
    const unitIVA = ivaIncludedInCost ? 0 : (unitCostAfterDiscount * ivaPct) / 100;
    const unitCostWithIVA = unitCostAfterDiscount + unitIVA;

    const freightLineTotal = freightPerLineTotal.get(line.id) ?? 0;
    const unitFreight = quantity > 0 ? safeDiv(freightLineTotal, quantity) : 0;

    const unitFinalCost = unitCostWithIVA + unitFreight;

    const marginPct = Math.max(0, n(line.marginPercentage));
    const margin = marginPct / 100;
    const unitSalePrice = unitFinalCost + unitFinalCost * margin;

    const totalDiscount = unitDiscount * quantity;
    const totalIVA = unitIVA * quantity;
    const totalFreight = unitFreight * quantity;
    const totalFinalCost = unitFinalCost * quantity;
    const totalSalePrice = unitSalePrice * quantity;
    const profit = totalSalePrice - totalFinalCost;

    return {
      ...line,
      quantity,
      totalCost,
      discountPercentage: discountPct,
      marginPercentage: marginPct,
      unitCost,
      unitDiscount,
      unitCostAfterDiscount,
      unitIVA,
      unitCostWithIVA,
      unitFreight,
      unitFinalCost,
      unitSalePrice,
      totalDiscount,
      totalIVA,
      totalFreight,
      totalFinalCost,
      totalSalePrice,
      profit,
    };
  });

  const totals: LiquidationTotals = {
    totalPurchaseCost: outLines.reduce((s, l) => s + n(l.totalCost), 0),
    totalDiscount: outLines.reduce((s, l) => s + n(l.totalDiscount), 0),
    totalIVA: outLines.reduce((s, l) => s + n(l.totalIVA), 0),
    totalFreight: useMultipleFreights
      ? normalizedRates.reduce((s, r) => s + n(r.cost), 0)
      : n(normalizedRates[0]?.cost),
    totalFinalCost: outLines.reduce((s, l) => s + n(l.totalFinalCost), 0),
    totalSalePrice: outLines.reduce((s, l) => s + n(l.totalSalePrice), 0),
    totalProfit: outLines.reduce((s, l) => s + n(l.profit), 0),
    profitMarginPercentage: 0,
  };

  totals.profitMarginPercentage = totals.totalSalePrice > 0 ? (totals.totalProfit / totals.totalSalePrice) * 100 : 0;

  return { lines: outLines, totals };
}
