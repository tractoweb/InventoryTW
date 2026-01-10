"use client";

import { useState, useEffect } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Terminal, FileSearch, Banknote, ShoppingCart, User, CalendarIcon } from "lucide-react";
import { searchDocuments, DocumentSearchResult } from "@/actions/search-documents";
import { getDocumentDetails, DocumentDetails } from "@/actions/get-document-details";
import { useDebounce } from "@/hooks/use-debounce";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function DocumentationPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<DocumentSearchResult[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [documentDetails, setDocumentDetails] = useState<DocumentDetails | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (debouncedSearchTerm.length > 1) {
      setIsSearching(true);
      setError(null);
      searchDocuments(debouncedSearchTerm)
        .then((result) => {
          if (result.error) {
            setError(result.error);
            setSearchResults([]);
          } else {
            setSearchResults(result.data || []);
          }
        })
        .finally(() => setIsSearching(false));
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    if (selectedDocumentId) {
      setIsLoadingDetails(true);
      setError(null);
      setDocumentDetails(null);
      getDocumentDetails(selectedDocumentId)
        .then((result) => {
          if (result.error) {
            setError(result.error);
          } else {
            setDocumentDetails(result.data || null);
          }
        })
        .finally(() => setIsLoadingDetails(false));
    }
  }, [selectedDocumentId]);

  const handleSelectDocument = (docId: number) => {
    setSelectedDocumentId(docId);
    setSearchTerm(""); // Limpiar búsqueda para ocultar el dropdown
    setSearchResults([]);
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
         <FileSearch className="h-8 w-8" />
         <h1 className="text-3xl font-bold tracking-tight">Buscador de Documentos</h1>
      </div>
      
      <Command className="relative overflow-visible rounded-lg border">
        <CommandInput
          placeholder="Busca por número de documento o nombre de cliente..."
          value={searchTerm}
          onValueChange={setSearchTerm}
        />
        {searchTerm.length > 1 && (
        <CommandList className="absolute top-full z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
          {isSearching && <CommandEmpty>Buscando...</CommandEmpty>}
          {!isSearching && searchResults.length === 0 && debouncedSearchTerm.length > 1 && (
            <CommandEmpty>No se encontraron documentos.</CommandEmpty>
          )}
          {searchResults.length > 0 && (
            <CommandGroup heading="Resultados de la búsqueda">
              {searchResults.map((doc) => (
                <CommandItem
                  key={doc.id}
                  onSelect={() => handleSelectDocument(doc.id)}
                  className="cursor-pointer"
                >
                  <div className="flex w-full justify-between">
                    <span>{doc.number}</span>
                    <span className="text-muted-foreground text-sm">{doc.customername}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        )}
      </Command>

      {error && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoadingDetails && <DetailsSkeleton />}

      {documentDetails && !isLoadingDetails && <DocumentDetailView document={documentDetails} formatCurrency={formatCurrency} />}

       {!selectedDocumentId && !isLoadingDetails && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
            <FileSearch className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Busca un documento</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                Usa la barra de búsqueda para encontrar un documento y ver sus detalles.
            </p>
        </div>
       )}
    </div>
  );
}

function DocumentDetailView({ document, formatCurrency }: { document: DocumentDetails, formatCurrency: (amount: number) => string }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna de Información General */}
            <div className="lg:col-span-1 flex flex-col gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 pb-2">
                         <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Información General</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <InfoRow label="Número" value={document.number} />
                        <InfoRow label="Tipo" value={document.documenttypename} />
                        <InfoRow label="Fecha" value={format(new Date(document.date), "d MMMM, yyyy", { locale: es })} />
                        <InfoRow label="Almacén" value={document.warehousename} />
                        <InfoRow label="Estado" value={<Badge variant={document.paidstatus === 1 ? "default" : "secondary"}>{document.paidstatus === 1 ? 'Pagado' : 'Pendiente'}</Badge>} />

                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 pb-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Cliente y Usuario</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <InfoRow label="Cliente" value={document.customername || 'N/A'} />
                        <InfoRow label="NIF Cliente" value={document.customertaxnumber || 'N/A'} />
                        <InfoRow label="Atendido por" value={document.username || 'N/A'} />
                    </CardContent>
                </Card>
            </div>

             {/* Columna de Items y Pagos */}
            <div className="lg:col-span-2 flex flex-col gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 pb-2">
                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Ítems del Documento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-center">Cant.</TableHead>
                                    <TableHead className="text-right">Precio Unit.</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {document.items.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.productname}</TableCell>
                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         <div className="mt-4 flex justify-end gap-4 border-t pt-4 font-medium">
                            <span>Subtotal</span>
                            <span>{formatCurrency(document.total - (document.items.reduce((acc, i) => acc + i.taxamount, 0)))}</span>
                         </div>
                         <div className="mt-2 flex justify-end gap-4 text-muted-foreground">
                            <span>Impuestos</span>
                            <span>{formatCurrency(document.items.reduce((acc, i) => acc + i.taxamount, 0))}</span>
                         </div>
                         <div className="mt-2 flex justify-end gap-4 border-t pt-2 text-lg font-bold">
                            <span>Total</span>
                            <span>{formatCurrency(document.total)}</span>
                         </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 pb-2">
                        <Banknote className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Pagos Registrados</CardTitle>
                    </CardHeader>
                    <CardContent>
                       {document.payments.length > 0 ? (
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {document.payments.map(payment => (
                                    <TableRow key={payment.id}>
                                        <TableCell>{format(new Date(payment.date), "dd/MM/yyyy")}</TableCell>
                                        <TableCell>{payment.paymenttypename}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                       ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No hay pagos registrados para este documento.</p>
                       )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

const InfoRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="flex justify-between">
        <span className="text-muted-foreground">{label}:</span>
        <span className="text-right font-medium">{value}</span>
    </div>
);


function DetailsSkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-1 flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                </Card>
            </div>
             <div className="lg:col-span-2 flex flex-col gap-6">
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/3" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/3" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
