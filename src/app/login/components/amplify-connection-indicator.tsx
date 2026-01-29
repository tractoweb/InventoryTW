"use client";

import * as React from "react";

import { getAmplifyStatusAction } from "@/actions/get-amplify-status";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type AmplifyStatus =
  | { state: "checking"; label: string; detail?: string }
  | { state: "ok"; label: string; detail?: string }
  | { state: "warning"; label: string; detail?: string }
  | { state: "error"; label: string; detail?: string };

function extractAmplifyErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  const e = error as any;

  const msg =
    e?.message ??
    e?.errors?.[0]?.message ??
    e?.name ??
    (typeof e?.toString === "function" ? String(e.toString()) : "");

  const recovery = e?.recoverySuggestion ? ` ${String(e.recoverySuggestion)}` : "";
  return String(msg ?? "").trim() + recovery;
}

function classifyAmplifyStatus(errorMessage: string): AmplifyStatus {
  const m = (errorMessage || "").toLowerCase();

  if (!m) {
    return { state: "error", label: "Amplify: error", detail: "Error desconocido" };
  }

  // Common auth errors
  if (
    m.includes("unauthorized") ||
    m.includes("not authorized") ||
    m.includes("forbidden") ||
    m.includes("401") ||
    m.includes("403") ||
    m.includes("invalid api key")
  ) {
    return {
      state: "error",
      label: "Amplify: sin autorización",
      detail: "Parece un problema de credenciales / modo de auth (API key / Cognito).",
    };
  }

  // Network / AWS availability
  if (
    m.includes("fetch") ||
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("econnreset") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("dns")
  ) {
    return {
      state: "warning",
      label: "Amplify: sin conexión",
      detail: "Parece un problema de red o disponibilidad de AWS/AppSync.",
    };
  }

  // Misconfiguration
  if (m.includes("configure") || m.includes("amplify") || m.includes("outputs")) {
    return {
      state: "error",
      label: "Amplify: configuración",
      detail: "Revisa amplify_outputs.json / Amplify.configure / sandbox.",
    };
  }

  return {
    state: "error",
    label: "Amplify: error",
    detail: errorMessage,
  };
}

export function AmplifyConnectionIndicator({
  className,
  pollMs = 15000,
}: {
  className?: string;
  pollMs?: number;
}) {
  const [status, setStatus] = React.useState<AmplifyStatus>({
    state: "checking",
    label: "Amplify: comprobando…",
  });

  const runCheck = React.useCallback(async () => {
    setStatus({ state: "checking", label: "Amplify: comprobando…" });

    try {
      const result = await getAmplifyStatusAction();
      if (!result.ok) {
        const msg = extractAmplifyErrorMessage(result.error);
        const classified = classifyAmplifyStatus(msg);
        setStatus({ ...classified, detail: msg });
        return;
      }

      setStatus({ state: "ok", label: "Amplify: OK", detail: "Conectado (server)." });
    } catch (e) {
      const msg = extractAmplifyErrorMessage(e);
      const classified = classifyAmplifyStatus(msg);
      setStatus({ ...classified, detail: msg });
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    void runCheck().finally(() => {
      // no-op
    });

    if (!pollMs || pollMs < 5000) return;

    const id = window.setInterval(() => {
      if (!alive) return;
      void runCheck();
    }, pollMs);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [pollMs, runCheck]);

  const variant =
    status.state === "ok"
      ? "default"
      : status.state === "checking"
        ? "secondary"
        : status.state === "warning"
          ? "secondary"
          : "destructive";

  const extraClass =
    status.state === "ok"
      ? "bg-emerald-600 text-white hover:bg-emerald-600"
      : status.state === "warning"
        ? "bg-amber-500 text-white hover:bg-amber-500"
        : status.state === "checking"
          ? "opacity-80"
          : "";

  return (
    <div className={cn("pointer-events-auto", className)}>
      <Badge
        variant={variant as any}
        title={status.detail}
        className={cn("select-none", extraClass)}
      >
        {status.label}
      </Badge>
    </div>
  );
}
