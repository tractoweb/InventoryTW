import "server-only";

import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

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

export type EmailConfigStatus = {
  configured: boolean;
  missing: string[];
  from: string | null;
  host: string | null;
  port: number | null;
  secure: boolean | null;
};

function readEnv(name: string): string | null {
  const direct = process.env[name];
  const directStr = direct ? String(direct).trim() : "";
  if (directStr) return directStr;

  // AWS Amplify Hosting may expose runtime secrets via `process.env.secrets` (SSM).
  const secrets = (process.env as any)?.secrets as Record<string, unknown> | undefined;
  const secretVal = secrets?.[name];
  const secretStr = secretVal ? String(secretVal).trim() : "";
  if (secretStr) return secretStr;

  // Some hosting setups expose env vars during build but not at SSR runtime.
  // As a fallback, read a build-time snapshot written into `.next/server/`.
  try {
    const cfgPath = path.join(process.cwd(), ".next", "server", "runtime-email-config.json");
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const v = parsed?.[name];
      const s = v ? String(v).trim() : "";
      if (s) return s;
    }
  } catch {
    // ignore
  }

  return null;
}

function requiredEnv(name: string): string {
  const v = readEnv(name);
  if (!v) throw new Error(`Falta configurar ${name} en el servidor`);
  return v;
}

function optionalEnv(name: string): string | null {
  return readEnv(name);
}

export function isEmailConfigured(): boolean {
  return Boolean(optionalEnv("SMTP_HOST") && optionalEnv("SMTP_FROM"));
}

export function getEmailConfigStatus(): EmailConfigStatus {
  const host = optionalEnv("SMTP_HOST");
  const from = optionalEnv("SMTP_FROM");

  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!from) missing.push("SMTP_FROM");

  const portRaw = optionalEnv("SMTP_PORT");
  const portNum = portRaw !== null ? Number(portRaw) : null;
  const port = portNum !== null && Number.isFinite(portNum) ? portNum : (portRaw !== null ? null : 587);

  const secureRaw = optionalEnv("SMTP_SECURE");
  const secure = secureRaw !== null ? String(secureRaw).toLowerCase() === "true" : null;

  return {
    configured: missing.length === 0,
    missing,
    from,
    host,
    port,
    secure,
  };
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
