/**
 * Servicio de Autenticación
 * Gestiona login, validación de sesión y logout
 */

'use server';

import { amplifyClient, ACCESS_LEVELS, formatAmplifyError } from '@/lib/amplify-config';

export interface LoginRequest {
  email: string;
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
export async function authenticateUser(email: string, password: string): Promise<LoginResponse> {
  try {
    // Buscar usuario por email
    const { data: users, errors } = await amplifyClient.models.User.list({
      filter: {
        email: { eq: email },
        isEnabled: { eq: true },
      },
    });

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

    // En producción: usar bcrypt o similar para validar hash
    // Por ahora comparación simple (TODO: implementar hash)
    if (user.password !== password) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Crear sesión
    const sessionToken = generateSessionToken(user.id);

    // Registrar sesión
    const sessionResult = await amplifyClient.models.SessionConfig.create({
      userId: user.id,
      accessLevel: user.accessLevel || ACCESS_LEVELS.CASHIER,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      loginTime: new Date().toISOString(),
      lastActivityTime: new Date().toISOString(),
      isActive: true,
      sessionToken: sessionToken,
    });

    if (!sessionResult.data) {
      return {
        success: false,
        error: 'Failed to create session',
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
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

/**
 * Valida una sesión activa
 */
export async function validateSession(userId: string, sessionToken: string) {
  try {
    const { data: sessions, errors } = await amplifyClient.models.SessionConfig.list({
      filter: {
        userId: { eq: userId },
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
      id: session.id,
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
export async function logoutUser(userId: string, sessionToken: string) {
  try {
    const { data: sessions } = await amplifyClient.models.SessionConfig.list({
      filter: {
        userId: { eq: userId },
        sessionToken: { eq: sessionToken },
      },
    });

    if (sessions && sessions.length > 0) {
      await amplifyClient.models.SessionConfig.update({
        id: sessions[0].id,
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
