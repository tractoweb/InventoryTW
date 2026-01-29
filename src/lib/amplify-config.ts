/**
 * Helpers compartidos (sin dependencias de AWS).
 *
 * IMPORTANT: No importar/configurar Amplify aquí.
 * - Este archivo se usa en Client Components.
 * - El cliente Data (IAM) vive en `src/lib/amplify-server.ts`.
 */

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
