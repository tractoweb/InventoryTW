"use server";

import "server-only";

import { amplifyClient } from "@/lib/amplify-server";

function extractAmplifyErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  const e = error as any;
  return String(
    e?.message ??
      e?.errors?.[0]?.message ??
      e?.name ??
      (typeof e?.toString === "function" ? String(e.toString()) : "")
  );
}

export type AmplifyConnectionStatus =
  | { ok: true }
  | { ok: false; error: string };

export async function getAmplifyStatusAction(): Promise<AmplifyConnectionStatus> {
  try {
    const res: any = await (amplifyClient as any).models.Company.list({ limit: 1 } as any);
    if (res?.errors?.length) {
      return { ok: false, error: extractAmplifyErrorMessage({ errors: res.errors }) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: extractAmplifyErrorMessage(e) };
  }
}
