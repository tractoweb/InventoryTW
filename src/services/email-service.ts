import nodemailer from "nodemailer";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendEmailInput = {
  to: string;
  cc?: string | null;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Falta configurar ${name} en el servidor`);
  return String(v).trim();
}

function optionalEnv(name: string): string | null {
  const v = process.env[name];
  const s = v ? String(v).trim() : "";
  return s ? s : null;
}

export function isEmailConfigured(): boolean {
  return Boolean(optionalEnv("SMTP_HOST") && optionalEnv("SMTP_FROM"));
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const host = requiredEnv("SMTP_HOST");
  const from = requiredEnv("SMTP_FROM");

  const port = Number(optionalEnv("SMTP_PORT") ?? 587);
  const secure = String(optionalEnv("SMTP_SECURE") ?? "false").toLowerCase() === "true";

  const user = optionalEnv("SMTP_USER");
  const pass = optionalEnv("SMTP_PASS");

  const tlsRejectUnauthorizedRaw = optionalEnv("SMTP_TLS_REJECT_UNAUTHORIZED");
  const tlsRejectUnauthorized = tlsRejectUnauthorizedRaw
    ? String(tlsRejectUnauthorizedRaw).toLowerCase() !== "false"
    : true;

  const transport = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: { rejectUnauthorized: tlsRejectUnauthorized },
  });

  await transport.sendMail({
    from,
    to: input.to,
    cc: input.cc ?? undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: (input.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType ?? "application/octet-stream",
    })),
  });
}
