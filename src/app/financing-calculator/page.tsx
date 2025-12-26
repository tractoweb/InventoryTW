"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Calculator, Printer } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Product {
  id: string
  name: string
  quantity: number
  totalCost: number
  individualMargin: number
  discountPercentage: number
  freightId: string
  purchaseReference: string
  warehouseReference: string
}

interface FreightRate {
  id: string
  name: string
  cost: number
}

export default function InvoiceCalculator() {
  const [ivaPercentage, setIvaPercentage] = useState<number | "">(19)
  const [globalMargin, setGlobalMargin] = useState<number | "">(40)
  const [ivaIncluded, setIvaIncluded] = useState(false)
  const [discountsEnabled, setDiscountsEnabled] = useState(true)

  const [useMultipleFreights, setUseMultipleFreights] = useState(false)
  const [freightRates, setFreightRates] = useState<FreightRate[]>([{ id: "1", name: "Flete 1", cost: 0 }])

  const [products, setProducts] = useState<Product[]>([
    {
      id: "1",
      name: "",
      quantity: 1,
      totalCost: 0,
      individualMargin: 30,
      discountPercentage: 0,
      freightId: "1",
      purchaseReference: "",
      warehouseReference: "",
    },
  ])

  const addFreightRate = () => {
    const newId = (freightRates.length + 1).toString()
    setFreightRates([...freightRates, { id: newId, name: `Flete ${newId}`, cost: 0 }])
  }

  const removeFreightRate = (id: string) => {
    if (freightRates.length > 1) {
      const remainingFreights = freightRates.filter((f) => f.id !== id)
      setFreightRates(remainingFreights)
      setProducts(products.map((p) => (p.freightId === id ? { ...p, freightId: remainingFreights[0].id } : p)))
    }
  }

  const updateFreightRate = (id: string, field: keyof FreightRate, value: string | number) => {
    setFreightRates(freightRates.map((f) => (f.id === id ? { ...f, [field]: value } : f)))
  }

  const addProduct = () => {
    setProducts([
      ...products,
      {
        id: Date.now().toString(),
        name: "",
        quantity: 1,
        totalCost: 0,
        individualMargin: typeof globalMargin === "number" ? globalMargin : 30,
        discountPercentage: 0,
        freightId: freightRates[0]?.id || "1",
        purchaseReference: "",
        warehouseReference: "",
      },
    ])
  }

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter((p) => p.id !== id))
    }
  }

  const updateProduct = (id: string, field: keyof Product, value: string | number) => {
    setProducts(products.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const calculateUnitCost = (product: Product) => {
    if (product.quantity === 0) return 0
    return product.totalCost / product.quantity
  }

  const calculateUnitCostWithDiscount = (product: Product) => {
    const unitCost = calculateUnitCost(product)
    if (!discountsEnabled) return unitCost
    const discount = product.discountPercentage / 100
    return unitCost * (1 - discount)
  }

  const calculateUnitCostWithIVA = (product: Product) => {
    const unitCostWithDiscount = calculateUnitCostWithDiscount(product)

    if (ivaIncluded) {
      return unitCostWithDiscount
    }

    const iva = typeof ivaPercentage === "number" ? ivaPercentage : 0
    return unitCostWithDiscount + (unitCostWithDiscount * iva) / 100
  }

  const calculateFreightPerUnit = (product: Product) => {
    if (!useMultipleFreights) {
      const freightValue = freightRates[0]?.cost || 0
      const totalProducts = products.length

      if (totalProducts === 0 || product.quantity === 0) return 0

      const freightPerProduct = freightValue / totalProducts
      return freightPerProduct / product.quantity
    } else {
      const assignedFreight = freightRates.find((f) => f.id === product.freightId)
      const freightValue = assignedFreight?.cost || 0

      const productsWithSameFreight = products.filter((p) => p.freightId === product.freightId)
      const totalProductsWithFreight = productsWithSameFreight.length

      if (totalProductsWithFreight === 0 || product.quantity === 0) return 0

      const freightPerProduct = freightValue / totalProductsWithFreight
      return freightPerProduct / product.quantity
    }
  }

  const calculateFinalUnitCost = (product: Product) => {
    const unitCostWithIVA = calculateUnitCostWithIVA(product)
    const freightPerUnit = calculateFreightPerUnit(product)
    return unitCostWithIVA + freightPerUnit
  }

  const calculateFinalSalePrice = (product: Product) => {
    const finalUnitCost = calculateFinalUnitCost(product)
    const margin = product.individualMargin / 100
    if (margin >= 1) return 0
    return finalUnitCost + finalUnitCost * margin
  }

  const calculateTotalPurchaseCost = () => {
    return products.reduce((sum, p) => sum + p.totalCost, 0)
  }

  const calculateTotalDiscount = () => {
    if (!discountsEnabled) return 0
    return products.reduce((sum, p) => {
      const unitCost = calculateUnitCost(p)
      const discountAmount = (unitCost * p.discountPercentage) / 100
      return sum + discountAmount * p.quantity
    }, 0)
  }

  const calculateTotalIVA = () => {
    if (ivaIncluded) return 0

    const iva = typeof ivaPercentage === "number" ? ivaPercentage : 0
    return products.reduce((sum, p) => {
      const unitCostWithDiscount = calculateUnitCostWithDiscount(p)
      return sum + (unitCostWithDiscount * p.quantity * iva) / 100
    }, 0)
  }

  const calculateTotalFreight = () => {
    if (!useMultipleFreights) {
      return freightRates[0]?.cost || 0
    }
    return freightRates.reduce((sum, f) => sum + f.cost, 0)
  }

  const calculateTotalSalePrice = () => {
    return products.reduce((sum, p) => {
      return sum + calculateFinalSalePrice(p) * p.quantity
    }, 0)
  }

  const calculateTotalProfit = () => {
    const totalPurchase = calculateTotalPurchaseCost()
    const totalDiscount = calculateTotalDiscount()
    const totalIVA = calculateTotalIVA()
    const totalFreight = calculateTotalFreight()
    const totalSale = calculateTotalSalePrice()

    return totalSale - (totalPurchase - totalDiscount + totalIVA + totalFreight)
  }

  const calculateTotalCost = () => {
    const totalProfit = calculateTotalProfit()
    const totalSale = calculateTotalSalePrice()

    return totalSale - totalProfit
  }

  const formatCurrency = (value: number) => {
    try {
      return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    } catch (error) {
      console.error("[v0] Error formatting currency:", error)
      return `$${value.toFixed(0)}`
    }
  }

  const handlePrintReport = () => {
    const hasDiscounts = discountsEnabled && products.some((p) => p.discountPercentage > 0)

    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reporte de Liquidación - Tracto Agrícola</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: letter portrait;
      margin: 0.4in 0.5in;
    }
    
    body { 
      font-family: Arial, sans-serif; 
      font-size: 15px; 
      line-height: 1.2; 
      color: #000;
    }
    
    .header { 
      text-align: center; 
      margin-bottom: 12px; 
      padding-bottom: 6px;
      border-bottom: 2px solid #000;
    }
    
    .header h1 { 
      font-size: 18px; 
      font-weight: bold; 
      margin-bottom: 3px; 
    }
    
    .header p { 
      font-size: 15px; 
      margin: 1px 0;
    }
    
    .section { 
      margin-bottom: 13px; 
    }
    
    .section-title { 
      font-size: 15px; 
      font-weight: bold; 
      margin-bottom: 5px;
      padding: 2px 0;
      border-bottom: 1px solid #333;
    }
    
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 6px;
    }
    
    th, td { 
      padding: 2px 4px; 
      text-align: left; 
      border: 0.5px solid #666;
      font-size: 15px;
    }
    
    th { 
      background-color: #e8e8e8; 
      font-weight: bold;
      font-size: 15px;
    }
    
    .text-right { text-align: right; }
    
    .config-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    
    .config-item {
      padding: 4px 6px;
      background: #f5f5f5;
      border: 0.5px solid #ccc;
    }
    
    .config-item .label {
      font-size: 14px;
      color: #555;
      margin-bottom: 1px;
    }
    
    .config-item .value {
      font-weight: bold;
      font-size: 16px;
    }
    
    .summary-grid { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 6px;
      margin-top: 6px;
    }
    
    .summary-item { 
      display: flex; 
      justify-content: space-between;
      padding: 2px 0;
      border-bottom: 0.5px dotted #888;
      font-size: 11px;
    }
    
    .summary-item .label { font-weight: normal; }
    .summary-item .value { font-weight: bold; }
    
    .summary-total {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1.5px solid #000;
    }
    
    .summary-total .item {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      font-size: 12px;
    }
    
    .summary-total .item.highlight {
      font-size: 17px;
      font-weight: bold;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid #333;
    }
    
    @media print {
      body { 
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>TRACTO AGRÍCOLA</h1>
    <p>Reporte de Liquidación de Facturas</p>
    <p>Fecha: ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>
  </div>

  <div class="section">
    <div class="section-title">Configuración General</div>
    <div class="config-grid">
      <div class="config-item">
        <div class="label">IVA</div>
        <div class="value">${ivaPercentage}%${ivaIncluded ? " (Incluido)" : ""}</div>
      </div>
      <div class="config-item">
        <div class="label">Flete Total</div>
        <div class="value">${formatCurrency(calculateTotalFreight())}</div>
      </div>
      <div class="config-item">
        <div class="label">Margen Global</div>
        <div class="value">${globalMargin}%</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalle de Productos</div>
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>Producto</th>
          <th>Ref. Compra</th>
          <th>Ref. Bodega</th>
          <th class="text-right">Cant.</th>
          <th class="text-right">Total</th>
          ${hasDiscounts ? '<th class="text-right">Desc.%</th>' : ""}
          <th class="text-right">Unit. Base</th>
          ${hasDiscounts ? '<th class="text-right">- Desc.</th>' : ""}
          <th class="text-right">+ IVA</th>
          <th class="text-right">+ Flete</th>
          <th class="text-right">P. Venta (${products[0]?.individualMargin || globalMargin}%)</th>
          ${useMultipleFreights ? '<th class="text-right">Flete</th>' : ""}
        </tr>
      </thead>
      <tbody>
        ${products
          .map(
            (product, index) => `
          <tr>
            <td style="text-align: center; font-weight: bold;">${index + 1}</td>
            <td>${product.name || "Sin nombre"}</td>
            <td>${product.purchaseReference || "-"}</td>
            <td>${product.warehouseReference || product.purchaseReference || "-"}</td>
            <td class="text-right">${product.quantity}</td>
            <td class="text-right">${formatCurrency(product.totalCost)}</td>
            ${hasDiscounts ? `<td class="text-right">${product.discountPercentage}%</td>` : ""}
            <td class="text-right">${formatCurrency(calculateUnitCost(product))}</td>
            ${hasDiscounts ? `<td class="text-right">${formatCurrency(calculateUnitCostWithDiscount(product))}</td>` : ""}
            <td class="text-right">${formatCurrency(calculateUnitCostWithIVA(product))}</td>
            <td class="text-right">${formatCurrency(calculateFinalUnitCost(product))}</td>
            <td class="text-right">${formatCurrency(calculateFinalSalePrice(product))}</td>
            ${useMultipleFreights ? `<td class="text-right">${freightRates.find((f) => f.id === product.freightId)?.name || ""}</td>` : ""}
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Resumen Financiero</div>
    <div class="summary-grid">
      <div class="summary-item">
        <span class="label">Costo Total de Compra:</span>
        <span class="value">${formatCurrency(calculateTotalPurchaseCost())}</span>
      </div>
      ${
        hasDiscounts
          ? `
      <div class="summary-item">
        <span class="label">Descuento Total Aplicado:</span>
        <span class="value">${formatCurrency(calculateTotalDiscount())}</span>
      </div>
      `
          : ""
      }
      <div class="summary-item">
        <span class="label">IVA Total:</span>
        <span class="value">${formatCurrency(calculateTotalIVA())}</span>
      </div>
      <div class="summary-item">
        <span class="label">Flete Distribuido:</span>
        <span class="value">${formatCurrency(calculateTotalFreight())}</span>
      </div>
    </div>
    
    <div class="summary-total">
      <div class="item highlight">
        <span>TOTAL COSTO:</span>
        <span>${formatCurrency(calculateTotalCost())}</span>
      </div>
      <div class="item">
        <span>Precio de Venta Total:</span>
        <span>${formatCurrency(calculateTotalSalePrice())}</span>
      </div>
      <div class="item highlight">
        <span>GANANCIA PROYECTADA:</span>
        <span>${formatCurrency(calculateTotalProfit())}</span>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    // Create a hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(reportHTML);
      iframeDoc.close();

      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }

    // Clean up the iframe after a delay
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-balance mb-2">Liquidación de Facturas</h1>
        <p className="text-muted-foreground text-pretty">
          Calcula costos, distribución de flete, IVA y márgenes de ganancia automáticamente
        </p>
      </div>

      {/* Configuración Global */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Configuración Global
          </CardTitle>
          <CardDescription>Parámetros que afectan a toda la factura</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="iva" className="text-sm font-medium">
                IVA (%)
              </Label>
              <Input
                id="iva"
                type="number"
                value={ivaPercentage}
                onChange={(e) => setIvaPercentage(e.target.value === "" ? "" : Number.parseFloat(e.target.value) || "")}
                placeholder="19"
                min="0"
                max="100"
                step="1"
                className="font-mono"
              />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="iva-included"
                  checked={ivaIncluded}
                  onCheckedChange={(checked) => setIvaIncluded(checked as boolean)}
                />
                <Label htmlFor="iva-included" className="text-xs text-muted-foreground font-normal cursor-pointer">
                  IVA ya incluido en costo
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="margin" className="text-sm font-medium">
                Margen de Ganancia Global (%)
              </Label>
              <Input
                id="margin"
                type="number"
                value={globalMargin}
                onChange={(e) => setGlobalMargin(e.target.value === "" ? "" : Number.parseFloat(e.target.value) || "")}
                placeholder="Ej: 30"
                min="0"
                max="100"
                step="1"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Opciones</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="discounts-enabled"
                  checked={discountsEnabled}
                  onCheckedChange={(checked) => setDiscountsEnabled(checked as boolean)}
                />
                <Label htmlFor="discounts-enabled" className="text-sm font-normal cursor-pointer">
                  Aplicar descuentos individuales
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="multiple-freights"
                  checked={useMultipleFreights}
                  onCheckedChange={(checked) => setUseMultipleFreights(checked as boolean)}
                />
                <Label htmlFor="multiple-freights" className="text-sm font-normal cursor-pointer">
                  Usar varios fletes diferentes
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Fletes</CardTitle>
              <CardDescription>
                {useMultipleFreights
                  ? "Configura diferentes opciones de flete y asígnalas a productos específicos"
                  : "Configura el costo de flete que se distribuirá entre todos los productos"}
              </CardDescription>
            </div>
            {useMultipleFreights && (
              <Button onClick={addFreightRate} size="sm" variant="outline" className="w-full sm:w-auto bg-transparent">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Flete
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {freightRates.map((freight) => (
              <div key={freight.id} className="flex gap-3 items-end">
                {useMultipleFreights && (
                  <div className="flex-1">
                    <Label htmlFor={`freight-name-${freight.id}`} className="text-sm">
                      Nombre del Flete
                    </Label>
                    <Input
                      id={`freight-name-${freight.id}`}
                      value={freight.name}
                      onChange={(e) => updateFreightRate(freight.id, "name", e.target.value)}
                      placeholder="Ej: Flete Express"
                      className="mt-1"
                    />
                  </div>
                )}
                <div className={useMultipleFreights ? "flex-1" : "flex-1"}>
                  <Label htmlFor={`freight-cost-${freight.id}`} className="text-sm">
                    {useMultipleFreights ? "Costo" : "Costo Total del Flete"}
                  </Label>
                  <Input
                    id={`freight-cost-${freight.id}`}
                    type="number"
                    value={freight.cost}
                    onChange={(e) => updateFreightRate(freight.id, "cost", Number.parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 50000"
                    min="0"
                    step="1000"
                    className="font-mono mt-1"
                  />
                </div>
                {useMultipleFreights && freightRates.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeFreightRate(freight.id)} className="mb-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/*Tabla de Productos */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Productos</CardTitle>
              <CardDescription>Ingresa cantidad, costo total y descuento de cada producto</CardDescription>
            </div>
            <Button onClick={addProduct} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Producto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className={useMultipleFreights ? "min-w-[1700px]" : "min-w-[1650px]"}>
              <div
                className={`grid gap-2 mb-3 pb-2 border-b font-medium text-sm text-muted-foreground ${useMultipleFreights ? "grid-cols-[40px_180px_110px_110px_70px_110px_90px_110px_110px_110px_90px_110px_120px_60px]" : "grid-cols-[40px_180px_110px_110px_70px_110px_90px_110px_110px_110px_90px_110px_60px]"}`}
              >
                <div className="text-center">#</div>
                <div>Nombre</div>
                <div>Ref. Compra</div>
                <div>Ref. Bodega</div>
                <div className="text-right">Cant.</div>
                <div className="text-right">Total</div>
                <div className="text-right">Desc. %</div>
                <div className="text-right">Unit. Base</div>
                <div className="text-right">- Descuento</div>
                <div className="text-right">+ IVA (19%)</div>
                <div className="text-right">+ Flete</div>
                <div className="text-right">Margen %</div>
                {useMultipleFreights && <div className="text-right">Flete Asignado</div>}
                <div className="text-right">Precio Venta</div>
                <div></div>
              </div>

              {products.map((product, index) => (
                <div
                  key={product.id}
                  className={`grid gap-2 mb-3 items-center ${useMultipleFreights ? "grid-cols-[40px_180px_110px_110px_70px_110px_90px_110px_110px_110px_90px_110px_120px_60px]" : "grid-cols-[40px_180px_110px_110px_70px_110px_90px_110px_110px_110px_90px_110px_60px]"}`}
                >
                  <div className="text-center font-semibold text-sm text-muted-foreground">{index + 1}</div>
                  <Input
                    value={product.name}
                    onChange={(e) => updateProduct(product.id, "name", e.target.value)}
                    placeholder="Nombre del producto"
                    className="h-9"
                  />
                  <Input
                    value={product.purchaseReference}
                    onChange={(e) => updateProduct(product.id, "purchaseReference", e.target.value)}
                    placeholder="Ref. compra"
                    className="h-9"
                  />
                  <Input
                    value={product.warehouseReference}
                    onChange={(e) => updateProduct(product.id, "warehouseReference", e.target.value)}
                    placeholder={product.purchaseReference || "Ref. bodega"}
                    className="h-9"
                  />
                  <Input
                    type="number"
                    value={product.quantity}
                    onChange={(e) => updateProduct(product.id, "quantity", Number.parseInt(e.target.value) || 0)}
                    min="1"
                    className="h-9 text-right font-mono"
                  />
                  <Input
                    type="number"
                    value={product.totalCost}
                    onChange={(e) => updateProduct(product.id, "totalCost", Number.parseFloat(e.target.value) || 0)}
                    min="0"
                    step="100"
                    placeholder="Total"
                    className="h-9 text-right font-mono"
                  />
                  <Input
                    type="number"
                    value={product.discountPercentage}
                    onChange={(e) =>
                      updateProduct(product.id, "discountPercentage", Number.parseFloat(e.target.value) || 0)
                    }
                    min="0"
                    max="100"
                    step="1"
                    placeholder="0"
                    className="h-9 text-right font-mono"
                    disabled={!discountsEnabled}
                  />
                  <div className="text-right text-sm font-mono bg-muted px-3 py-2 rounded-md">
                    {formatCurrency(calculateUnitCost(product))}
                  </div>
                  <div className="text-right text-sm font-mono bg-muted px-3 py-2 rounded-md">
                    {formatCurrency(calculateUnitCostWithDiscount(product))}
                  </div>
                  <div className="text-right text-sm font-mono bg-muted px-3 py-2 rounded-md">
                    {formatCurrency(calculateUnitCostWithIVA(product))}
                  </div>
                  <div className="text-right text-sm font-mono bg-muted px-3 py-2 rounded-md">
                    {formatCurrency(calculateFinalUnitCost(product))}
                  </div>
                  <Input
                    type="number"
                    value={product.individualMargin}
                    onChange={(e) =>
                      updateProduct(product.id, "individualMargin", Number.parseFloat(e.target.value) || 0)
                    }
                    min="0"
                    max="99"
                    step="1"
                    className="h-9 text-right font-mono"
                  />
                  {useMultipleFreights && (
                    <Select
                      value={product.freightId}
                      onValueChange={(value) => updateProduct(product.id, "freightId", value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {freightRates.map((freight) => (
                          <SelectItem key={freight.id} value={freight.id}>
                            {freight.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="text-right text-sm font-mono font-semibold bg-accent/10 text-accent px-3 py-2 rounded-md">
                    {formatCurrency(calculateFinalSalePrice(product))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProduct(product.id)}
                    disabled={products.length === 1}
                    className="h-9 w-9"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <Card className="bg-primary text-primary-foreground">
        <CardHeader>
          <CardTitle>Resumen Financiero</CardTitle>
          <CardDescription className="text-primary-foreground/80">Vista general de costos y ganancias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-primary-foreground/80">Costo Total de Compra</div>
              <div className="text-2xl font-bold font-mono">{formatCurrency(calculateTotalPurchaseCost())}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-primary-foreground/80">Descuento Total Aplicado</div>
              <div className="text-2xl font-bold font-mono">{formatCurrency(calculateTotalDiscount())}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-primary-foreground/80">IVA Total {ivaIncluded && "(Ya incluido)"}</div>
              <div className="text-2xl font-bold font-mono">{formatCurrency(calculateTotalIVA())}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-primary-foreground/80">Flete Distribuido</div>
              <div className="text-2xl font-bold font-mono">{formatCurrency(calculateTotalFreight())}</div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-primary-foreground/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-primary-foreground/80">Costo de factura</div>
                <div className="text-3xl font-bold font-mono">{formatCurrency(calculateTotalCost())}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-primary-foreground/80">Precio de Venta Sugerido</div>
                <div className="text-3xl font-bold font-mono">{formatCurrency(calculateTotalSalePrice())}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-primary-foreground/80">Ganancia Proyectada</div>
                <div className="text-3xl font-bold font-mono text-accent-foreground bg-accent/20 px-4 py-2 rounded-lg">
                  {formatCurrency(calculateTotalProfit())}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-center">
        <Button onClick={handlePrintReport} size="lg" variant="outline" className="gap-2 bg-transparent">
          <Printer className="h-5 w-5" />
          Imprimir Reporte
        </Button>
      </div>
    </div>
  )
}
