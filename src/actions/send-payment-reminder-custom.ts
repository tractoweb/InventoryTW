"use server";

import "server-only";

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
  cc: z.string().trim().optional().nullable(),
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(20_000),
  attachDocIds: z.array(z.coerce.number().int().min(1)).min(0).max(3),
});

export type SendPaymentReminderCustomInput = z.input<typeof InputSchema>;

function sanitizeFilenamePart(value: unknown) {
  return String(value ?? "documento")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function sendPaymentReminderCustomAction(
  raw: SendPaymentReminderCustomInput
): Promise<{ success: boolean; error?: string }> {
  noStore();

  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    await requireSession(ACCESS_LEVELS.CASHIER);

    const { to, cc, subject, text } = parsed.data;

    const docIds = Array.from(new Set(parsed.data.attachDocIds.map((n) => Number(n))))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 3);

    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];

    for (const documentId of docIds) {
      const res: any = await getDocumentDetails(documentId);
      if (res?.error || !res?.data) continue;
      const details = res.data;

      const fileName = `documento-${sanitizeFilenamePart(details.documenttypename)}-${sanitizeFilenamePart(details.number || documentId)}.pdf`;
      const element = React.createElement(DocumentReportPdfServer as any, { details } as any) as any;
      const pdfBuffer = (await renderToBuffer(element as any)) as unknown as Buffer;

      attachments.push({ filename: fileName, content: pdfBuffer, contentType: "application/pdf" });
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
