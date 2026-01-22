/**
 * Configuración del cliente Amplify
 * Este archivo centraliza la configuración y proporciona funciones helper
 * para trabajar con la API de Amplify Data
 */


import { Amplify } from 'aws-amplify';
import amplifyconfig from '../../amplify_outputs.json';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../amplify/data/resource.ts';

Amplify.configure(amplifyconfig);

function safeJson(value: unknown, maxLen: number): string {
  try {
    const s = JSON.stringify(value);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "…";
  } catch {
    return "[unserializable]";
  }
}

function createTracedAmplifyClient<T extends { models: Record<string, any> }>(client: T): T {
  // Only trace in Node (server) and only when explicitly enabled.
  const enabled =
    typeof window === "undefined" &&
    process.env.NODE_ENV !== "production" &&
    process.env.AMPLIFY_TRACE === "1";
  if (!enabled) return client;

  const modelProxyCache = new Map<string, any>();

  const modelsProxy = new Proxy(client.models, {
    get(modelsTarget, modelName: string) {
      const name = String(modelName);
      if (modelProxyCache.has(name)) return modelProxyCache.get(name);

      const modelClient = (modelsTarget as any)[modelName];
      if (!modelClient || typeof modelClient !== "object") return modelClient;

      const proxiedModel = new Proxy(modelClient, {
        get(target, propKey: string) {
          const prop = String(propKey);
          const orig = (target as any)[propKey];
          if (typeof orig !== "function") return orig;

          // Wrap common Amplify Data operations; leave everything else untouched.
          const shouldWrap =
            prop === "list" ||
            prop === "get" ||
            prop === "create" ||
            prop === "update" ||
            prop === "delete";
          if (!shouldWrap) return orig;

          return async (...args: any[]) => {
            const started = Date.now();
            try {
              return await orig(...args);
            } finally {
              const elapsed = Date.now() - started;
              // Keep logs short; args can be large (filters, selections, etc.)
              const argsPreview = args.length ? safeJson(args[0], 600) : "";
              // Example: [amplify] Product.list 184ms {"limit":100,"nextToken":"…"}
              console.log(`[amplify] ${name}.${prop} ${elapsed}ms${argsPreview ? " " + argsPreview : ""}`);
            }
          };
        },
      });

      modelProxyCache.set(name, proxiedModel);
      return proxiedModel;
    },
  });

  return new Proxy(client, {
    get(target, propKey: string) {
      if (propKey === "models") return modelsProxy;
      return (target as any)[propKey];
    },
  });
}

export const amplifyClient = createTracedAmplifyClient(generateClient<Schema>());

export const ACCESS_LEVELS = {
  CASHIER: 0,
  ADMIN: 1,
  MASTER: 9,
} as const;

export type AccessLevel = typeof ACCESS_LEVELS[keyof typeof ACCESS_LEVELS];

export const DOCUMENT_STOCK_DIRECTION = {
  NONE: 0,
  IN: 1,      // Entrada (compra)
  OUT: -1,    // Salida (venta)
} as const;

// Some legacy datasets store OUT as `2` (instead of -1). Keep the code tolerant.
export function normalizeStockDirection(value: unknown): (typeof DOCUMENT_STOCK_DIRECTION)[keyof typeof DOCUMENT_STOCK_DIRECTION] {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return DOCUMENT_STOCK_DIRECTION.NONE;
  if (n === DOCUMENT_STOCK_DIRECTION.IN) return DOCUMENT_STOCK_DIRECTION.IN;
  if (n === DOCUMENT_STOCK_DIRECTION.OUT) return DOCUMENT_STOCK_DIRECTION.OUT;
  if (n === 2) return DOCUMENT_STOCK_DIRECTION.OUT;
  return DOCUMENT_STOCK_DIRECTION.NONE;
}

export function isStockDirectionIn(value: unknown): boolean {
  return normalizeStockDirection(value) === DOCUMENT_STOCK_DIRECTION.IN;
}

export function isStockDirectionOut(value: unknown): boolean {
  return normalizeStockDirection(value) === DOCUMENT_STOCK_DIRECTION.OUT;
}

export const KARDEX_TYPES = {
  ENTRADA: 'ENTRADA',
  SALIDA: 'SALIDA',
  AJUSTE: 'AJUSTE',
} as const;

/**
 * Helper para validar acceso basado en accessLevel
 */
export function validateAccessLevel(userLevel: AccessLevel, requiredLevel: AccessLevel): boolean {
  return userLevel >= requiredLevel;
}

/**
 * Helper para formatear errores de Amplify
 */
export function formatAmplifyError(error: any): string {
  if (error?.message) {
    return error.message;
  }
  if (error?.errors?.[0]?.message) {
    return error.errors[0].message;
  }
  return 'An error occurred';
}
