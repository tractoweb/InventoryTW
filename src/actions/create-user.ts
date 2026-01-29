"use server";

import { z } from "zod";

import { amplifyClient } from "@/lib/amplify-server";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";
import { hashPasswordForStorage } from "@/services/auth-service";
import { writeAuditLog } from "@/services/audit-log-service";
import { toPlainJson } from "@/lib/safe-serializable";

export interface CreateUserInput {
  username: string;
  password: string;
  accessLevel?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  isEnabled?: boolean;
}

const CreateUserSchema = z.object({
  username: z
    .string({ required_error: "Usuario requerido" })
    .trim()
    .min(3, "Usuario: mínimo 3 caracteres")
    .max(64, "Usuario: máximo 64 caracteres"),
  password: z
    .string({ required_error: "Contraseña requerida" })
    .min(4, "Contraseña: mínimo 4 caracteres")
    .max(128, "Contraseña: demasiado larga"),
  accessLevel: z.number().int().min(0).optional(),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  isEnabled: z.boolean().optional(),
});

type CreateUserField = "username" | "password" | "email" | "firstName" | "lastName" | "accessLevel" | "isEnabled";
type FieldErrors = Partial<Record<CreateUserField, string>>;

async function getNextUserId(): Promise<number> {
  const result = await listAllPages(amplifyClient.models.User.list);
  if ("error" in result && result.error) {
    throw new Error(result.error);
  }

  const users = result.data ?? [];
  let maxId = 0;
  for (const user of users as any[]) {
    const value = Number(user.userId);
    if (Number.isFinite(value) && value > maxId) maxId = value;
  }
  return maxId + 1;
}

export async function createUser(input: CreateUserInput) {
  try {
    const session = await requireSession(ACCESS_LEVELS.ADMIN);

    const parsed = CreateUserSchema.safeParse({
      username: input.username,
      password: input.password,
      accessLevel: input.accessLevel,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      isEnabled: input.isEnabled,
    });

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "") as CreateUserField;
        if (!key) continue;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { success: false as const, error: "Revisa los campos", fieldErrors };
    }

    const values = parsed.data;

    const normalizedUsername = values.username;
    const normalizedPassword = values.password;
    const normalizedEmail = values.email ? String(values.email).trim() : undefined;
    const normalizedFirstName = values.firstName?.trim();
    const normalizedLastName = values.lastName?.trim();

    // Prevent confusing silent failures: check duplicates early.
    const existingResult = await listAllPages(amplifyClient.models.User.list);
    if ("error" in existingResult && existingResult.error) {
      throw new Error(existingResult.error);
    }
    const existing = (existingResult.data ?? []) as any[];
    const exists = existing.some(
      (u) => String(u?.username ?? "").trim().toLowerCase() === normalizedUsername.toLowerCase()
    );
    if (exists) {
      return {
        success: false as const,
        error: "Revisa los campos",
        fieldErrors: { username: "Ese usuario ya existe" } satisfies FieldErrors,
      };
    }

    const userId = await getNextUserId();

    const result = await amplifyClient.models.User.create({
      userId,
      username: normalizedUsername,
      password: hashPasswordForStorage(normalizedPassword),
      accessLevel: input.accessLevel ?? 0,
      firstName: normalizedFirstName || undefined,
      lastName: normalizedLastName || undefined,
      email: normalizedEmail ? normalizedEmail : undefined,
      isEnabled: input.isEnabled ?? true,
    });

    if ((result as any)?.errors?.length) {
      const msg = (result as any).errors?.[0]?.message;
      throw new Error(msg || "No se pudo crear usuario");
    }

    writeAuditLog({
      userId: session.userId,
      action: "CREATE",
      tableName: "User",
      recordId: userId,
      newValues: {
        userId,
        username: normalizedUsername,
        accessLevel: input.accessLevel ?? 0,
        firstName: normalizedFirstName || null,
        lastName: normalizedLastName || null,
        email: normalizedEmail || null,
        isEnabled: input.isEnabled ?? true,
      },
    }).catch(() => {});

    const data: any = result.data as any;
    const user = toPlainJson(data ?? {}, [
      "userId",
      "username",
      "firstName",
      "lastName",
      "email",
      "accessLevel",
      "isEnabled",
      "createdAt",
      "updatedAt",
    ]);

    return { success: true as const, user };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear usuario" };
  }
}
