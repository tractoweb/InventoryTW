"use server";

import "server-only";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { isEmailConfigured } from "@/services/email-service";

const DocSchema = z.object({
  documentId: z.coerce.number().int().min(1),
  number: z.string().optional(),
  pendingApprox: z.coerce.number().optional(),
  dueDate: z.string().nullable().optional(),
  daysOverdue: z.coerce.number().optional(),
});

const InputSchema = z.object({
  kind: z.enum(["client", "supplier"]),
  to: z.string().trim().min(3),
  partyName: z.string().trim().min(1),
  docs: z.array(DocSchema).min(1).max(50),
});

export type BuildPaymentReminderDraftInput = z.input<typeof InputSchema>;

export type PaymentReminderDraft = {
  configured: boolean;
  from: string | null;
  defaultCc: string | null;
  subject: string;
  text: string;
  attachments: Array<{
    documentId: number;
    label: string;
    defaultSelected: boolean;
  }>;
};

function moneyCop(value: unknown): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

export async function buildPaymentReminderDraftAction(
  raw: BuildPaymentReminderDraftInput
): Promise<{ success: true; data: PaymentReminderDraft } | { success: false; error: string }> {
  noStore();

  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    await requireSession(ACCESS_LEVELS.CASHIER);

    const configured = isEmailConfigured();

    const from = process.env.SMTP_FROM ? String(process.env.SMTP_FROM).trim() : null;
    const defaultCc = process.env.SMTP_DEFAULT_CC ? String(process.env.SMTP_DEFAULT_CC).trim() : null;

    const { kind, partyName, docs } = parsed.data;

    const title = "Recordatorio de pago";
    const subject = `${title} · ${partyName}`;

    const normalizedDocs = docs
      .map((d) => ({
        documentId: Number(d.documentId),
        number: d.number ? String(d.number) : undefined,
        pendingApprox: d.pendingApprox !== undefined ? Number(d.pendingApprox) : undefined,
        dueDate: d.dueDate !== undefined ? d.dueDate : undefined,
        daysOverdue: d.daysOverdue !== undefined ? Number(d.daysOverdue) : undefined,
      }))
      .filter((d) => Number.isFinite(d.documentId) && d.documentId > 0);

    const lines = normalizedDocs
      .slice(0, 12)
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
      "Te compartimos un recordatorio de pago.",
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

    const attachmentCandidates = normalizedDocs
      .slice()
      .sort(
        (a, b) =>
          Number(b.daysOverdue ?? 0) - Number(a.daysOverdue ?? 0) || Number(b.pendingApprox ?? 0) - Number(a.pendingApprox ?? 0)
      )
      .slice(0, 10)
      .map((d, index) => {
        const labelParts = [String(d.number ?? d.documentId)];
        if ((d.daysOverdue ?? 0) > 0) labelParts.push(`${d.daysOverdue}d venc.`);
        if (d.pendingApprox !== undefined) labelParts.push(`Pend. ${moneyCop(d.pendingApprox)}`);

        return {
          documentId: d.documentId,
          label: labelParts.join(" · "),
          defaultSelected: index < 3,
        };
      });

    return {
      success: true,
      data: {
        configured,
        from,
        defaultCc,
        subject,
        text,
        attachments: attachmentCandidates,
      },
    };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "No se pudo construir el borrador" };
  }
}
