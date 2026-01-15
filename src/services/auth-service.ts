/**
 * Servicio de Autenticación
 * Gestiona login, validación de sesión y logout
 */

import { amplifyClient, ACCESS_LEVELS, formatAmplifyError } from '@/lib/amplify-config';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    accessLevel: number;
  };
  sessionToken?: string;
  error?: string;
}

/**
 * Autentica un usuario contra la base de datos
 * En producción, esto debería usar hashing y validaciones más robustas
 */
export async function authenticateUser(usernameOrEmail: string, password: string): Promise<LoginResponse> {
  try {
    const identifier = String(usernameOrEmail ?? "").trim();
    if (!identifier) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Buscar usuario por username (y opcionalmente email por compatibilidad)
    const { data: users, errors } = await amplifyClient.models.User.list({
      filter: {
        and: [
          { isEnabled: { eq: true } },
          {
            or: [
              { username: { eq: identifier } },
              { email: { eq: identifier } },
            ],
          },
        ],
      },
    } as any);

    if (errors) {
      return {
        success: false,
        error: 'Error querying database',
      };
    }

    if (!users || users.length === 0) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    const user = users[0];

    const storedPassword = String((user as any).password ?? '');
    const passwordOk = verifyPassword(password, storedPassword);

    if (!passwordOk) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Migración suave: si aún está en texto plano, hashear y guardar.
    if (storedPassword && !storedPassword.startsWith('scrypt$')) {
      try {
        await amplifyClient.models.User.update({
          userId: Number((user as any).userId),
          password: hashPassword(password),
        } as any);
      } catch {
        // Best-effort: no bloquear login.
      }
    }

    // Crear sesión
    const sessionToken = generateSessionToken((user as any).userId);

    // Registrar sesión (SessionConfig tiene PK userId: upsert)
    const normalizedUserId = Number((user as any).userId);
    const existing = await amplifyClient.models.SessionConfig.get({ userId: normalizedUserId } as any).catch(() => null);

    const sessionPayload: any = {
      userId: normalizedUserId,
      accessLevel: user.accessLevel || ACCESS_LEVELS.CASHIER,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      loginTime: new Date().toISOString(),
      lastActivityTime: new Date().toISOString(),
      isActive: true,
      sessionToken: sessionToken,
    };

    const sessionResult = (existing as any)?.data
      ? await amplifyClient.models.SessionConfig.update(sessionPayload)
      : await amplifyClient.models.SessionConfig.create(sessionPayload);

    if (!sessionResult?.data) {
      return {
        success: false,
        error: 'Failed to create session',
      };
    }

    return {
      success: true,
      user: {
        id: String((user as any).userId),
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        accessLevel: user.accessLevel || ACCESS_LEVELS.CASHIER,
      },
      sessionToken: sessionToken,
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

export function hashPasswordForStorage(password: string): string {
  return hashPassword(password);
}

/**
 * Valida una sesión activa
 */
export async function validateSession(userId: string | number, sessionToken: string) {
  try {
    const normalizedUserId = Number(userId);
    const { data: sessions, errors } = await amplifyClient.models.SessionConfig.list({
      filter: {
        userId: { eq: normalizedUserId },
        sessionToken: { eq: sessionToken },
        isActive: { eq: true },
      },
    });

    if (errors || !sessions || sessions.length === 0) {
      return { valid: false };
    }

    const session = sessions[0];

    // Actualizar lastActivityTime
    await amplifyClient.models.SessionConfig.update({
      userId: Number((session as any).userId),
      lastActivityTime: new Date().toISOString(),
    });

    return {
      valid: true,
      session: session,
    };
  } catch (error) {
    return { valid: false };
  }
}

/**
 * Cierra la sesión de un usuario
 */
export async function logoutUser(userId: string | number, sessionToken: string) {
  try {
    const normalizedUserId = Number(userId);
    const { data: sessions } = await amplifyClient.models.SessionConfig.list({
      filter: {
        userId: { eq: normalizedUserId },
        sessionToken: { eq: sessionToken },
      },
    });

    if (sessions && sessions.length > 0) {
      await amplifyClient.models.SessionConfig.update({
        userId: Number((sessions[0] as any).userId),
        isActive: false,
      });
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Genera un token de sesión simple
 * En producción, usar JWT con expiración
 */
function generateSessionToken(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${userId}-${timestamp}-${random}`;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  // Legacy: plain text
  if (!stored.startsWith('scrypt$')) return stored === password;

  // Format: scrypt$N$r$p$<saltB64>$<hashB64>
  const parts = stored.split('$');
  if (parts.length < 6) return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltB64 = parts[4];
  const hashB64 = parts[5];
  if (![N, r, p].every((n) => Number.isFinite(n) && n > 0)) return false;

  try {
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = scryptSync(password, salt, expected.length, { N, r, p });
    return timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}
