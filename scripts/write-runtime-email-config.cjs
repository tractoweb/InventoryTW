/*
  Writes runtime config into the deployed Next.js server bundle so it can be read
  at runtime even if the hosting provider doesn't inject env vars into the
  compute runtime.

  Output: .next/server/runtime-email-config.json

  SECURITY NOTE:
  - This file is placed under .next/server (not publicly served).
  - Avoid logging the values.
*/

const fs = require("fs");
const path = require("path");

function pick(name) {
  const v = process.env[name];
  const s = v ? String(v).trim() : "";
  return s ? s : null;
}

function main() {
  const nextDir = path.join(process.cwd(), ".next");
  const serverDir = path.join(nextDir, "server");

  if (!fs.existsSync(nextDir) || !fs.existsSync(serverDir)) {
    // Not a Next build output; do nothing.
    return;
  }

  const outFile = path.join(serverDir, "runtime-email-config.json");

  const data = {
    SMTP_HOST: pick("SMTP_HOST"),
    SMTP_FROM: pick("SMTP_FROM"),
    SMTP_PORT: pick("SMTP_PORT"),
    SMTP_SECURE: pick("SMTP_SECURE"),
    SMTP_USER: pick("SMTP_USER"),
    SMTP_PASS: pick("SMTP_PASS"),
    SMTP_DEFAULT_CC: pick("SMTP_DEFAULT_CC"),
    SMTP_TLS_REJECT_UNAUTHORIZED: pick("SMTP_TLS_REJECT_UNAUTHORIZED"),
    BEDROCK_ACCESS_KEY_ID: pick("BEDROCK_ACCESS_KEY_ID"),
    BEDROCK_SECRET_ACCESS_KEY: pick("BEDROCK_SECRET_ACCESS_KEY"),
    AI_BEDROCK_REGION: pick("AI_BEDROCK_REGION"),
    AI_MODEL_PRIMARY: pick("AI_MODEL_PRIMARY"),
    AI_MODEL: pick("AI_MODEL"),
    AI_MAX_TOKENS: pick("AI_MAX_TOKENS"),
  };

  fs.writeFileSync(outFile, JSON.stringify(data), { encoding: "utf8" });
}

main();
