"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { getRealtimeAuditLogsAction, type RealtimeAuditToastRow } from "@/actions/get-realtime-audit-logs";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "realtime:audit:lastSeen";

const TOAST_ACTIONS = ["CREATE", "UPDATE", "DELETE", "HARD_DELETE", "SOFT_DELETE"] as const;
const TOAST_TABLES = [
  "Product",
  "Customer",
  "Warehouse",
  "Tax",
  "PaymentType",
  "User",
  "Company",
  "ApplicationSettings",
  "Document",
] as const;

const TABLE_LABELS: Record<string, string> = {
  Product: "Producto",
  Customer: "Cliente/Proveedor",
  Warehouse: "Almacén",
  Tax: "Impuesto",
  PaymentType: "Tipo de pago",
  User: "Usuario",
  Company: "Empresa",
  ApplicationSettings: "Configuración",
  Document: "Documento",
};

function tsToMs(ts: unknown): number {
  const s = String(ts ?? "");
  if (!s) return 0;
  const ms = new Date(s).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function pickTitle(action: string, tableName: string): string {
  const entity = TABLE_LABELS[tableName] ?? tableName ?? "Registro";

  if (action === "CREATE") return `${entity} creado`;
  if (action === "UPDATE") return `${entity} actualizado`;
  if (action === "DELETE") return `${entity} eliminado`;
  if (action === "HARD_DELETE") return `${entity} eliminado`;
  if (action === "SOFT_DELETE") return `${entity} eliminado`;

  return `${action || "ACT"} · ${entity}`;
}

export function RealtimeAuditToasts() {
  const pathname = usePathname() ?? "/";
  const { toast } = useToast();

  React.useEffect(() => {
    if (pathname === "/login") return;
    if (typeof window === "undefined") return;

    // Avoid spamming toasts with historical data.
    // Start from the latest of: stored lastSeen OR now.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    let lastSeenMs = Math.max(tsToMs(stored), Date.now());
    window.localStorage.setItem(STORAGE_KEY, new Date(lastSeenMs).toISOString());

    const handleRows = (rows: any[]) => {
      const normalized = (Array.isArray(rows) ? rows : [])
        .map((r) => ({
          raw: r,
          ms: tsToMs(r?.timestamp),
          logId: String(r?.logId ?? ""),
          action: String(r?.action ?? ""),
          tableName: String(r?.tableName ?? ""),
          recordId: Number(r?.recordId ?? 0),
        }))
        .filter((x) => x.ms > 0 && x.ms > lastSeenMs)
        .filter((x) => TOAST_TABLES.includes(x.tableName as any) && TOAST_ACTIONS.includes(x.action as any))
        .sort((a, b) => a.ms - b.ms)
        .slice(0, 5);

      if (normalized.length === 0) return;

      for (const item of normalized) {
        toast({
          title: pickTitle(item.action, item.tableName),
          description: item.recordId > 0 ? `ID: ${item.recordId}` : undefined,
        });
        lastSeenMs = Math.max(lastSeenMs, item.ms);
      }

      window.localStorage.setItem(STORAGE_KEY, new Date(lastSeenMs).toISOString());
    };

    let interval: ReturnType<typeof setInterval> | null = null;

    const listLatest = async () => {
      try {
        const res = await getRealtimeAuditLogsAction({
          sinceIso: new Date(lastSeenMs).toISOString(),
          limit: 50,
        });
        if (res?.error) return;
        handleRows((res?.data ?? []) as RealtimeAuditToastRow[]);
      } catch {
        // ignore
      }
    };

    // Poll from server (no browser Amplify credentials needed).
    interval = setInterval(listLatest, 8000);
    listLatest();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pathname, toast]);

  return null;
}
