"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal } from "lucide-react";

import { getDocumentDetails, type DocumentDetails } from "@/actions/get-document-details";
import { DocumentReportPdf } from "./document-report";

export default function DocumentPdfPage() {
  const params = useParams<{ documentId: string }>();
  const documentId = Number(params?.documentId);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<DocumentDetails | null>(null);

  React.useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!Number.isFinite(documentId) || documentId <= 0) throw new Error("Documento inválido");
        const res: any = await getDocumentDetails(documentId);
        if (res?.error) throw new Error(String(res.error));
        if (!res?.data) throw new Error("No se pudo cargar el documento");
        if (!alive) return;
        setDetails(res.data as DocumentDetails);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudo cargar el documento");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [documentId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>PDF del documento</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/documents">Volver a Documentos</Link>
            </Button>
            {details ? (
              <PDFDownloadLink
                document={<DocumentReportPdf details={details} />}
                fileName={`documento-${details.number || documentId}.pdf`}
              >
                {({ loading: dlLoading }) => (
                  <Button disabled={dlLoading}>{dlLoading ? "Generando…" : "Descargar PDF"}</Button>
                )}
              </PDFDownloadLink>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-[70vh] w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : !details ? (
            <div className="text-sm text-muted-foreground">Sin información.</div>
          ) : (
            <div className="h-[80vh] w-full overflow-hidden rounded border">
              <PDFViewer width="100%" height="100%" showToolbar>
                <DocumentReportPdf details={details} />
              </PDFViewer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
