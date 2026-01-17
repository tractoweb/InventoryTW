export const CACHE_TAGS = {
  ref: {
    warehouses: "ref:warehouses",
    taxes: "ref:taxes",
    productGroups: "ref:product-groups",
    countries: "ref:countries",
    currencies: "ref:currencies",
  },
  heavy: {
    stockData: "heavy:stock-data",
    dashboardOverview: "heavy:dashboard-overview",
    documents: "heavy:documents",
    productsMaster: "heavy:products-master",
    productDetails: "heavy:product-details",
  },
} as const;
