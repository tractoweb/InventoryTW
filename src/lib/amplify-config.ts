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

export const amplifyClient = generateClient<Schema>();

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
