import { renderToBuffer } from "@react-pdf/renderer";
import * as React from "react";
import { Buffer } from "buffer";
import crypto from "crypto";

import { getDocumentDetails } from "@/actions/get-document-details";
import { DocumentReportPdfServer } from "../document-report.server";

export const runtime = "nodejs";

function computeDetailsEtag(details: any) {
  // Weak ETag: good enough to skip regenerating the same PDF across repeated opens.
  // Keep payload small-ish but representative of the rendered content.
  const signature = {
    id: details?.id,
    number: details?.number,
    date: details?.date,
    stockdate: details?.stockdate,
    total: details?.total,
    paidstatus: details?.paidstatus,
    warehousename: details?.warehousename,
    documenttypename: details?.documenttypename,
    documenttypecode: details?.documenttypecode,
    documenttypeprinttemplate: details?.documenttypeprinttemplate,
    customername: details?.customername,
    customertaxnumber: details?.customertaxnumber,
    customercountryname: details?.customercountryname,
    username: details?.username,
    internalnote: details?.internalnote,
    items: Array.isArray(details?.items)
      ? details.items.map((it: any) => ({
          id: it?.id,
          productid: it?.productid,
          quantity: it?.quantity,
          price: it?.price,
          unitcost: it?.unitcost,
          total: it?.total,
          taxamount: it?.taxamount,
        }))
      : [],
    payments: Array.isArray(details?.payments)
      ? details.payments.map((p: any) => ({
          id: p?.id,
          date: p?.date,
          amount: p?.amount,
          paymenttypename: p?.paymenttypename,
        }))
      : [],
    liquidationTotals: details?.liquidation?.result?.totals ?? null,
  };

  const hash = crypto
    .createHash("sha1")
    .update(JSON.stringify(signature))
    .digest("base64");

  return `W/"${hash}"`;
}

function sanitizeFilenamePart(value: unknown) {
  return String(value ?? "documento")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function GET(
  request: Request,
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

  const etag = computeDetailsEtag(details);
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        // Private because docs can contain customer data.
        "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
        Vary: "Cookie",
      },
    });
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
      ETag: etag,
      // Cache in-browser to speed up repeated opens.
      // Keep it private to avoid shared cache leaks.
      "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
      Vary: "Cookie",
    },
  });
}
