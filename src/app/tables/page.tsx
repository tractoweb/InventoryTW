'use client';

import { useState, useEffect } from 'react';
import { getTableData } from '@/actions/get-table-data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TableData = { [key: string]: any };

const tableOptions = [
    { value: 'applicationproperty', label: 'Propiedades Aplicación (applicationproperty)' },
    { value: 'barcode', label: 'Códigos de Barras (barcode)' },
    { value: 'company', label: 'Compañía (company)' },
    { value: 'counter', label: 'Contadores (counter)' },
    { value: 'country', label: 'Países (country)' },
    { value: 'currency', label: 'Monedas (currency)' },
    { value: 'customer', label: 'Clientes (customer)' },
    { value: 'customerdiscount', label: 'Descuentos Cliente (customerdiscount)' },
    { value: 'document', label: 'Documentos (document)' },
    { value: 'documentcategory', label: 'Categorías Documento (documentcategory)' },
    { value: 'documentitem', label: 'Items Documento (documentitem)' },
    { value: 'documentitemexpirationdate', label: 'Fechas Expiración Item (documentitemexpirationdate)' },
    { value: 'documentitemtax', label: 'Impuestos Item Documento (documentitemtax)' },
    { value: 'documenttype', label: 'Tipos Documento (documenttype)' },
    { value: 'fiscalitem', label: 'Items Fiscales (fiscalitem)' },
    { value: 'floorplan', label: 'Planos de Planta (floorplan)' },
    { value: 'floorplantable', label: 'Mesas Plano Planta (floorplantable)' },
    { value: 'loyaltycard', label: 'Tarjetas Fidelidad (loyaltycard)' },
    { value: 'migration', label: 'Migraciones (migration)' },
    { value: 'payment', label: 'Pagos (payment)' },
    { value: 'paymenttype', label: 'Tipos de Pago (paymenttype)' },
    { value: 'posorder', label: 'Órdenes POS (posorder)' },
    { value: 'posorderitem', label: 'Items Órden POS (posorderitem)' },
    { value: 'posprinterselection', label: 'Selección Impresora POS (posprinterselection)' },
    { value: 'posprinterselectionsettings', label: 'Conf. Selección Impresora POS (posprinterselectionsettings)' },
    { value: 'posprintersettings', label: 'Conf. Impresora POS (posprintersettings)' },
    { value: 'posvoid', label: 'Anulaciones POS (posvoid)' },
    { value: 'product', label: 'Productos (product)' },
    { value: 'productcomment', label: 'Comentarios Producto (productcomment)' },
    { value: 'productgroup', label: 'Grupos Producto (productgroup)' },
    { value: 'producttax', label: 'Impuestos Producto (producttax)' },
    { value: 'promotion', label: 'Promociones (promotion)' },
    { value: 'promotionitem', label: 'Items Promoción (promotionitem)' },
    { value: 'securitykey', label: 'Claves Seguridad (securitykey)' },
    { value: 'startingcash', label: 'Dinero Inicial Caja (startingcash)' },
    { value: 'stock', label: 'Inventario (stock)' },
    { value: 'stockcontrol', label: 'Control Inventario (stockcontrol)' },
    { value: 'tax', label: 'Impuestos (tax)' },
    { value: 'template', label: 'Plantillas (template)' },
    { value: 'user', label: 'Usuarios (user)' },
    { value: 'voidreason', label: 'Razones Anulación (voidreason)' },
    { value: 'warehouse', label: 'Almacenes (warehouse)' },
    { value: 'zreport', label: 'Reportes Z (zreport)' },
  ];

export default function TablesPage() {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  
  const rowsPerPage = 10;
  const pageCount = Math.ceil(tableData.length / rowsPerPage);
  const paginatedData = tableData.slice(
    page * rowsPerPage,
    (page + 1) * rowsPerPage
  );


  useEffect(() => {
    if (!selectedTable) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setTableData([]);
      setColumns([]);
      setPage(0);

      try {
        const result = await getTableData(selectedTable);
        if (result.error) {
          setError(result.error);
        } else if (result.data && result.columns) {
          setTableData(result.data);
          setColumns(result.columns);
        }
      } catch (e: any) {
        setError(e.message || 'Ocurrió un error inesperado.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedTable]);
  
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return '[Object]';
        }
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    return String(value);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          Visualizador de Tablas
        </h1>
        <div className="w-full md:w-auto">
          <Select onValueChange={setSelectedTable} value={selectedTable}>
            <SelectTrigger className="w-full md:w-[280px]">
              <SelectValue placeholder="Selecciona una tabla" />
            </SelectTrigger>
            <SelectContent>
              {tableOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {error && (
         <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error de Base de Datos</AlertTitle>
            <AlertDescription>
                {error}
            </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <ScrollArea>
          <Table>
            <TableHeader>
              <TableRow>
                {isLoading ? (
                  <>
                      {[...Array(5)].map((_, i) => (
                          <TableHead key={i}><Skeleton className="h-5 w-24" /></TableHead>
                      ))}
                  </>
                ) : (
                  columns.map((col) => <TableHead key={col} className="capitalize">{col.replace(/_/g, ' ')}</TableHead>)
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                      {[...Array(columns.length || 5)].map((_, cellIndex) => (
                          <TableCell key={cellIndex}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                  </TableRow>
                ))
              ) : paginatedData.length > 0 ? (
                paginatedData.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map((col) => (
                      <TableCell key={col} className="max-w-[200px] truncate" title={formatValue(row[col])}>
                        {formatValue(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length || 1} className="h-24 text-center">
                    {selectedTable ? "No hay datos o la tabla está vacía." : "Selecciona una tabla para mostrar los datos."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <div className="flex items-center justify-end space-x-2 py-4 px-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
          >
            Anterior
          </Button>
          <span className="text-sm">
            Página {page + 1} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount - 1}
          >
            Siguiente
          </Button>
        </div>
      </div>

    </div>
  );
}