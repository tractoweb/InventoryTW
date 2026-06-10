"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import type { ProductFilters } from "@/types/product-traceability";

export interface AdvancedProductFiltersProps {
  onFiltersChange: (filters: ProductFilters) => void;
  onApply: () => void;
  productGroups: Array<{ id: number; name: string }>;
  warehouses: Array<{ id: number; name: string }>;
  users: Array<{ id: number; username: string; firstName?: string; lastName?: string }>;
  isLoading?: boolean;
}

export function AdvancedProductFilters({
  onFiltersChange,
  onApply,
  productGroups,
  warehouses,
  users,
  isLoading = false,
}: AdvancedProductFiltersProps) {
  const [filters, setFilters] = React.useState<ProductFilters>({});
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    basic: true,
    codes: false,
    inventory: false,
    financial: false,
    documents: false,
    config: false,
    disabled: false,
  });

  const handleFilterChange = (key: keyof ProductFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleReset = () => {
    setFilters({});
    onFiltersChange({});
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const activeFilterCount = React.useMemo(() => {
    return Object.values(filters).filter((v) => v !== undefined && v !== null && v !== "").length;
  }, [filters]);

  return (
    <div className="space-y-4">
      {/* Barra de resumen */}
      <div className="flex items-center justify-between bg-muted p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Filtros activos: {activeFilterCount}</p>
            <p className="text-xs text-muted-foreground">Ajusta los filtros abajo para buscar</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={activeFilterCount === 0}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
          <Button size="sm" onClick={onApply} disabled={isLoading}>
            {isLoading ? "Buscando..." : "Buscar"}
          </Button>
        </div>
      </div>

      {/* SECCIÓN 1: BÁSICOS */}
      <Card>
        <Collapsible open={expandedSections.basic} onOpenChange={() => toggleSection("basic")}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className="h-4 w-4 transition-transform"
                    style={{
                      transform: expandedSections.basic ? "rotate(0)" : "rotate(-90deg)",
                    }}
                  />
                  <CardTitle className="text-base">📊 Filtros Básicos</CardTitle>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 border-t pt-4">
              {/* Búsqueda */}
              <div>
                <label className="text-sm font-medium mb-2 block">Búsqueda</label>
                <Input
                  placeholder="Nombre, código, barcode..."
                  value={filters.search || ""}
                  onChange={(e) => handleFilterChange("search", e.target.value || undefined)}
                />
              </div>

              {/* Grupo */}
              <div>
                <label className="text-sm font-medium mb-2 block">Grupo de Producto</label>
                <Select
                  value={String(filters.groupId || "")}
                  onValueChange={(v) =>
                    handleFilterChange("groupId", v ? Number(v) : undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los grupos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los grupos</SelectItem>
                    {productGroups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Estado */}
              <div>
                <label className="text-sm font-medium mb-2 block">Estado</label>
                <div className="flex gap-3">
                  {[
                    { value: "active", label: "🟢 Activos", color: "bg-green-100" },
                    { value: "disabled", label: "🔴 Deshabilitados", color: "bg-red-100" },
                    { value: "merged", label: "🟡 Merged", color: "bg-yellow-100" },
                  ].map((state) => (
                    <label key={state.value} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.states?.includes(state.value as any) ?? false}
                        onCheckedChange={(checked) => {
                          const current = filters.states ?? [];
                          const updated = checked
                            ? [...current, state.value as any]
                            : current.filter((s) => s !== state.value);
                          handleFilterChange("states", updated.length > 0 ? updated : undefined);
                        }}
                      />
                      <span className="text-sm">{state.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* SECCIÓN 2: CÓDIGOS Y DUPLICADOS */}
      <Card>
        <Collapsible open={expandedSections.codes} onOpenChange={() => toggleSection("codes")}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className="h-4 w-4 transition-transform"
                    style={{
                      transform: expandedSections.codes ? "rotate(0)" : "rotate(-90deg)",
                    }}
                  />
                  <CardTitle className="text-base">🏷️ Códigos & Duplicados</CardTitle>
                </div>
                {(filters.showDuplicates || filters.showDuplicateCandidates) && (
                  <Badge variant="destructive">Activo</Badge>
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.showOnlyWithCode ?? false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("showOnlyWithCode", checked ? true : undefined)
                  }
                />
                <span className="text-sm">Mostrar solo con código</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.showDuplicates ?? false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("showDuplicates", checked ? true : undefined)
                  }
                />
                <span className="text-sm">
                  ⚠️ Mostrar DUPLICADOS (mismo código)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.showDuplicateCandidates ?? false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("showDuplicateCandidates", checked ? true : undefined)
                  }
                />
                <span className="text-sm">Mostrar CANDIDATOS a duplicado</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.showNoBarcode ?? false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("showNoBarcode", checked ? true : undefined)
                  }
                />
                <span className="text-sm">Mostrar sin barcode</span>
              </label>

              <div>
                <label className="text-sm font-medium mb-2 block">Código específico</label>
                <Input
                  placeholder="Ej: MB-001"
                  value={filters.duplicateCode || ""}
                  onChange={(e) =>
                    handleFilterChange("duplicateCode", e.target.value || undefined)
                  }
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* SECCIÓN 3: INVENTARIO */}
      <Card>
        <Collapsible
          open={expandedSections.inventory}
          onOpenChange={() => toggleSection("inventory")}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{
                    transform: expandedSections.inventory ? "rotate(0)" : "rotate(-90deg)",
                  }}
                />
                <CardTitle className="text-base">📦 Inventario</CardTitle>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 border-t pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Stock</label>
                <Select
                  value={filters.stockFilter || "all"}
                  onValueChange={(v) => handleFilterChange("stockFilter", v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="with">Con stock</SelectItem>
                    <SelectItem value="without">Sin stock</SelectItem>
                    <SelectItem value="low">Stock bajo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Almacén</label>
                <Select
                  value={String(filters.warehouseId || "")}
                  onValueChange={(v) =>
                    handleFilterChange("warehouseId", v ? Number(v) : undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los almacenes</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Cantidad mín</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.stockMin || ""}
                    onChange={(e) =>
                      handleFilterChange(
                        "stockMin",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Cantidad máx</label>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={filters.stockMax || ""}
                    onChange={(e) =>
                      handleFilterChange(
                        "stockMax",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.showNegativeStock ?? false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("showNegativeStock", checked ? true : undefined)
                  }
                />
                <span className="text-sm">Mostrar stock negativo</span>
              </label>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* SECCIÓN 4: FINANCIERO */}
      <Card>
        <Collapsible
          open={expandedSections.financial}
          onOpenChange={() => toggleSection("financial")}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{
                    transform: expandedSections.financial ? "rotate(0)" : "rotate(-90deg)",
                  }}
                />
                <CardTitle className="text-base">💰 Datos Financieros</CardTitle>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Precio mín</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.priceMin || ""}
                    onChange={(e) =>
                      handleFilterChange(
                        "priceMin",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Precio máx</label>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={filters.priceMax || ""}
                    onChange={(e) =>
                      handleFilterChange(
                        "priceMax",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Costo mín</label>
                  <Input
                    type="number"
                    value={filters.costMin || ""}
                    onChange={(e) =>
                      handleFilterChange(
                        "costMin",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Costo máx</label>
                  <Input
                    type="number"
                    value={filters.costMax || ""}
                    onChange={(e) =>
                      handleFilterChange(
                        "costMax",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.showNoPrice ?? false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("showNoPrice", checked ? true : undefined)
                  }
                />
                <span className="text-sm">Mostrar sin precio</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.showNoCost ?? false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("showNoCost", checked ? true : undefined)
                  }
                />
                <span className="text-sm">Mostrar sin costo</span>
              </label>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* SECCIÓN 5: DESHABILITACIÓN (IMPORTANTE) */}
      <Card className="border-red-200 bg-red-50">
        <Collapsible
          open={expandedSections.disabled}
          onOpenChange={() => toggleSection("disabled")}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-red-100/50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{
                    transform: expandedSections.disabled ? "rotate(0)" : "rotate(-90deg)",
                  }}
                />
                <CardTitle className="text-base">🗑️ Deshabilitación & Trazabilidad</CardTitle>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 border-t border-red-200 pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Razón de deshabilitación</label>
                <Select
                  value={filters.disabledReason || "all"}
                  onValueChange={(v) =>
                    handleFilterChange("disabledReason", v === "all" ? "all" : (v as any))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las razones</SelectItem>
                    <SelectItem value="Accidental">Accidental</SelectItem>
                    <SelectItem value="Duplicate">Duplicado</SelectItem>
                    <SelectItem value="Obsolete">Obsoleto</SelectItem>
                    <SelectItem value="Temporary">Temporal</SelectItem>
                    <SelectItem value="MERGED_WITH_PRIMARY">Merged con otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Período</label>
                <Select
                  value={filters.disabledPeriod || "all"}
                  onValueChange={(v) => handleFilterChange("disabledPeriod", v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los períodos</SelectItem>
                    <SelectItem value="7days">Últimos 7 días</SelectItem>
                    <SelectItem value="30days">Últimos 30 días</SelectItem>
                    <SelectItem value="90days">Últimos 90 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Deshabilitado por</label>
                <Select
                  value={String(filters.disabledBy || "")}
                  onValueChange={(v) =>
                    handleFilterChange("disabledBy", v ? Number(v) : undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cualquier usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Cualquier usuario</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.firstName || u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.showAccidentallyDisabled ?? false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("showAccidentallyDisabled", checked ? true : undefined)
                  }
                />
                <span className="text-sm font-semibold text-red-700">
                  ⚠️ Mostrar deshabilitados ACCIDENTALMENTE
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.showCandidatesToMerge ?? false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("showCandidatesToMerge", checked ? true : undefined)
                  }
                />
                <span className="text-sm">Mostrar candidatos a fusionar</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.showMerged ?? false}
                  onCheckedChange={(checked) =>
                    handleFilterChange("showMerged", checked ? true : undefined)
                  }
                />
                <span className="text-sm">Mostrar ya fusionados</span>
              </label>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
