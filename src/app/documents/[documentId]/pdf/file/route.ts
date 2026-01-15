import { renderToBuffer } from "@react-pdf/renderer";
import * as React from "react";
import { Buffer } from "buffer";

import { getDocumentDetails } from "@/actions/get-document-details";
import { DocumentReportPdfServer } from "../document-report.server";

export const runtime = "nodejs";

function sanitizeFilenamePart(value: unknown) {
  return String(value ?? "documento")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function GET(
  _request: Request,
  context: { params: { documentId: string } }
): Promise<Response> {
  const documentId = Number(context?.params?.documentId);
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return new Response("Documento inválido", { status: 400 });
  }

  const res: any = await getDocumentDetails(documentId);
  if (res?.error) {
    return new Response(String(res.error), { status: 404 });
  }
  const details = res?.data;
  if (!details) {
    return new Response("No se pudo cargar el documento", { status: 500 });
  }

  const fileName = `documento-${sanitizeFilenamePart(details.documenttypename)}-${sanitizeFilenamePart(details.number || documentId)}.pdf`;

  const element = React.createElement(
    DocumentReportPdfServer as any,
    { details } as any
  ) as any;
  const pdfBuffer = (await renderToBuffer(element as any)) as unknown as Buffer;

  return new Response(pdfBuffer as unknown as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=\"${fileName}\"`,
      "Cache-Control": "no-store",
    },
  });
}
