"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";

import { sendEmail } from "@/services/email-service";

import { renderToBuffer } from "@react-pdf/renderer";
import * as React from "react";
import { Buffer } from "buffer";

import { getDocumentDetails } from "@/actions/get-document-details";
import { DocumentReportPdfServer } from "@/app/documents/[documentId]/pdf/document-report.server";

const InputSchema = z.object({
  kind: z.enum(["client", "supplier"]),
  to: z.string().trim().min(3),
  cc: z.string().trim().optional(),
  partyName: z.string().trim().min(1),
  docs: z
    .array(
      z.object({
        documentId: z.coerce.number().int().min(1),
        number: z.string().optional(),
        pendingApprox: z.coerce.number().optional(),
        dueDate: z.string().nullable().optional(),
        daysOverdue: z.coerce.number().optional(),
      })
    )
    .min(1)
    .max(20),
});

export type SendPaymentReminderInput = z.input<typeof InputSchema>;

function sanitizeFilenamePart(value: unknown) {
  return String(value ?? "documento")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function moneyCop(value: unknown): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

export async function sendPaymentReminderAction(
  raw: SendPaymentReminderInput
): Promise<{ success: boolean; error?: string }> {
  noStore();

  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    await requireSession(ACCESS_LEVELS.CASHIER);

    const { kind, to, cc, partyName } = parsed.data;

    const docs = parsed.data.docs
      .map((d) => ({
        documentId: Number(d.documentId),
        number: d.number ? String(d.number) : undefined,
        pendingApprox: d.pendingApprox !== undefined ? Number(d.pendingApprox) : undefined,
        dueDate: d.dueDate !== undefined ? d.dueDate : undefined,
        daysOverdue: d.daysOverdue !== undefined ? Number(d.daysOverdue) : undefined,
      }))
      .filter((d) => Number.isFinite(d.documentId) && d.documentId > 0);

    if (!docs.length) return { success: false, error: "No hay documentos para enviar" };

    const label = kind === "client" ? "pago" : "pago";
    const title = kind === "client" ? "Recordatorio de pago" : "Recordatorio de pago";

    const subject = `${title} · ${partyName}`;

    const lines = docs
      .slice(0, 10)
      .map((d) => {
        const due = d.dueDate ? ` (vence ${d.dueDate})` : "";
        const ov = (d.daysOverdue ?? 0) > 0 ? ` · ${d.daysOverdue} día(s) vencido` : "";
        const pend = d.pendingApprox !== undefined ? ` · Pendiente ${moneyCop(d.pendingApprox)}` : "";
        return `- Doc ${d.number ?? d.documentId}${pend}${due}${ov}`;
      })
      .join("\n");

    const text = [
      "Buen día,",
      "",
      `Te compartimos un recordatorio de ${label}.`,
      "",
      `${kind === "client" ? "Cliente" : "Proveedor"}: ${partyName}`,
      "",
      "Documentos:",
      lines || "- (sin detalle)",
      "",
      "Adjuntamos el/los PDF del/los documento(s).",
      "",
      "Gracias.",
    ].join("\n");

    // Attach up to 3 PDFs to avoid huge emails/timeouts.
    const attachDocIds = docs
      .slice()
      .sort((a, b) => (Number(b.daysOverdue ?? 0) - Number(a.daysOverdue ?? 0)) || Number(b.pendingApprox ?? 0) - Number(a.pendingApprox ?? 0))
      .slice(0, 3)
      .map((d) => d.documentId);

    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];

    for (const documentId of attachDocIds) {
      const res: any = await getDocumentDetails(documentId);
      if (res?.error || !res?.data) continue;
      const details = res.data;

      const fileName = `documento-${sanitizeFilenamePart(details.documenttypename)}-${sanitizeFilenamePart(details.number || documentId)}.pdf`;

      const element = React.createElement(DocumentReportPdfServer as any, { details } as any) as any;
      const pdfBuffer = (await renderToBuffer(element as any)) as unknown as Buffer;

      attachments.push({
        filename: fileName,
        content: pdfBuffer,
        contentType: "application/pdf",
      });
    }

    await sendEmail({
      to,
      cc: cc ? String(cc) : undefined,
      subject,
      text,
      attachments,
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
