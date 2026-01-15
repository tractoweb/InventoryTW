"use client";

const DEFAULT_BROWSERPRINT_PORT = process.env.NEXT_PUBLIC_BROWSERPRINT_PORT ?? "9101";
const LOCAL_SDK_URL = `http://localhost:${DEFAULT_BROWSERPRINT_PORT}/BrowserPrint-3.0.216.min.js`;

const VENDOR_SDK_URLS = [
  "/vendor/BrowserPrint-3.1.250.min.js",
  "/vendor/BrowserPrint-3.0.216.min.js",
];

const DEFAULT_SDK_URLS = [LOCAL_SDK_URL, ...VENDOR_SDK_URLS];
const SCRIPT_ID = "zebra-browserprint-sdk";

export class BrowserPrintNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserPrintNotReadyError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} (timeout ${ms}ms)`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new Error("Impresión cancelada"));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("Impresión cancelada"));
    signal.addEventListener("abort", onAbort, { once: true });

    promise
      .then((v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      })
      .catch((e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      });
  });
}

export function isHttps(): boolean {
  return typeof window !== "undefined" && window.location?.protocol === "https:";
}

export async function loadBrowserPrintSdk(options?: {
  src?: string;
  srcs?: string[];
  timeoutMs?: number;
}): Promise<void> {
  if (typeof window === "undefined") return;

  if (window.BrowserPrint) return;

  const envSrc = process.env.NEXT_PUBLIC_BROWSERPRINT_SDK_URL;
  const envSrcs = process.env.NEXT_PUBLIC_BROWSERPRINT_SDK_URLS;

  const envList = envSrcs
    ? envSrcs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const srcs =
    (options?.src ? [options.src] : undefined) ??
    options?.srcs ??
    (envSrc ? [envSrc] : null) ??
    envList ??
    DEFAULT_SDK_URLS;
  const timeoutMs = options?.timeoutMs ?? 4000;

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    // If the script is already in the DOM, wait a bit for it to finish.
    await withTimeout(
      new Promise<void>((resolve) => {
        const start = Date.now();
        const tick = () => {
          if (window.BrowserPrint) return resolve();
          if (Date.now() - start > timeoutMs) return resolve();
          setTimeout(tick, 50);
        };
        tick();
      }),
      timeoutMs + 250,
      "BrowserPrint SDK wait"
    );

    if (window.BrowserPrint) return;
  }

  let lastError: unknown = null;
  for (const src of srcs) {
    try {
      // If the source is same-origin (e.g. /vendor/...), check if it's actually present
      // to provide a clearer error than the generic script onerror.
      if (src.startsWith("/")) {
        const head = await withTimeout(
          fetch(src, { method: "HEAD" }),
          Math.min(1500, timeoutMs),
          `BrowserPrint SDK HEAD (${src})`
        );
        if (!head.ok) {
          if (VENDOR_SDK_URLS.includes(src)) {
            throw new BrowserPrintNotReadyError(
              `No se encontró el SDK en ${src}. Coloca BrowserPrint-3.x.x.min.js en public/vendor/ (ver public/vendor/README.md) y reinicia el servidor.`
            );
          }
          throw new BrowserPrintNotReadyError(`No se pudo acceder al recurso ${src} (HTTP ${head.status}).`);
        }
      }

      await withTimeout(
        new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.id = SCRIPT_ID;
          s.src = src;
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new BrowserPrintNotReadyError(`No se pudo cargar el SDK de BrowserPrint desde ${src}`));
          document.body.appendChild(s);
        }),
        timeoutMs,
        `BrowserPrint SDK load (${src})`
      );

      if (window.BrowserPrint) return;

      // If script loaded but BrowserPrint didn't attach, try next source.
      lastError = new BrowserPrintNotReadyError(
        `El SDK se cargó desde ${src}, pero window.BrowserPrint no quedó disponible.`
      );
    } catch (e) {
      lastError = e;
    }

    // Clean up script tag before trying the next source.
    const node = document.getElementById(SCRIPT_ID);
    if (node?.parentNode) node.parentNode.removeChild(node);
  }

  throw lastError instanceof Error
    ? lastError
    : new BrowserPrintNotReadyError("No se pudo cargar BrowserPrint SDK.");

  // Unreachable
}

export async function listLocalPrinters(options?: {
  timeoutMs?: number;
}): Promise<BrowserPrintDevice[]> {
  await loadBrowserPrintSdk();
  const timeoutMs = options?.timeoutMs ?? 2500;

  return withTimeout(
    new Promise<BrowserPrintDevice[]>((resolve, reject) => {
      window.BrowserPrint!.getLocalDevices(
        (devices) => resolve(devices ?? []),
        (err) => reject(err),
        "printer"
      );
    }),
    timeoutMs,
    "BrowserPrint getLocalDevices"
  );
}

export async function getDefaultPrinter(options?: {
  timeoutMs?: number;
}): Promise<BrowserPrintDevice> {
  await loadBrowserPrintSdk();
  const timeoutMs = options?.timeoutMs ?? 2500;

  return withTimeout(
    new Promise<BrowserPrintDevice>((resolve, reject) => {
      window.BrowserPrint!.getDefaultDevice("printer", resolve, reject);
    }),
    timeoutMs,
    "BrowserPrint getDefaultDevice"
  );
}

export async function sendZpl(
  device: BrowserPrintDevice,
  zpl: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 6000;

  // Many Zebra/BrowserPrint setups are happier when the payload ends with a newline.
  const payload = zpl.endsWith("\n") || zpl.endsWith("\r") ? zpl : `${zpl}\n`;

  const promise = new Promise<void>((resolve, reject) => {
    device.send(
      payload,
      () => resolve(),
      (err) => {
        if (err instanceof Error) return reject(err);
        const msg = typeof err === "string" ? err : `BrowserPrint error: ${String(err)}`;
        reject(new Error(msg));
      }
    );
  });

  // BrowserPrint doesn't provide a true cancel for an in-flight send,
  // but we can unblock the UI and stop the queue immediately.
  return withTimeout(withAbort(promise, options?.signal), timeoutMs, "BrowserPrint device.send");
}

export async function sendZplWithRetry(
  device: BrowserPrintDevice,
  zpl: string,
  options?: { timeoutMs?: number; retries?: number; retryDelayMs?: number; signal?: AbortSignal }
): Promise<void> {
  const retries = options?.retries ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 250;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (options?.signal?.aborted) throw new Error("Impresión cancelada");
      await sendZpl(device, zpl, { timeoutMs: options?.timeoutMs, signal: options?.signal });
      return;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const signal: AbortSignal | undefined = (options as any)?.signal;
        if (signal?.aborted) break;
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, retryDelayMs * (attempt + 1));
          if (!signal) return;
          const onAbort = () => {
            clearTimeout(t);
            resolve();
          };
          signal.addEventListener("abort", onAbort, { once: true });
        });
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Error enviando ZPL a la impresora");
}
