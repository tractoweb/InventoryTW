"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { hashPasswordForStorage } from "@/services/auth-service";
import { writeAuditLog } from "@/services/audit-log-service";

const UpdateUserSchema = z.object({
  userId: z.coerce.number().int().positive(),
  username: z.string().min(1).optional(),
  password: z.string().min(4).optional(),
  accessLevel: z.coerce.number().int().min(0).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Email inválido" }),
  isEnabled: z.coerce.boolean().optional(),
});

export type UpdateUserInput = z.input<typeof UpdateUserSchema>;

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const s = String(value);
  const trimmed = s.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function updateUserAction(raw: UpdateUserInput): Promise<{ success: boolean; error?: string }> {
  noStore();
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = UpdateUserSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const input = parsed.data;

    const beforeRes: any = await amplifyClient.models.User.get({ userId: Number(input.userId) } as any);
    const before = beforeRes?.data as any;

    const payload: any = {
      userId: Number(input.userId),
    };

    const username = normalizeOptionalString(input.username);
    if (username !== undefined) payload.username = username;

    const firstName = normalizeOptionalString(input.firstName);
    if (firstName !== undefined) payload.firstName = firstName;

    const lastName = normalizeOptionalString(input.lastName);
    if (lastName !== undefined) payload.lastName = lastName;

    const email = normalizeOptionalString(input.email);
    if (email !== undefined) payload.email = email;

    if (input.accessLevel !== undefined) payload.accessLevel = Number(input.accessLevel);
    if (input.isEnabled !== undefined) payload.isEnabled = Boolean(input.isEnabled);

    if (input.password !== undefined) {
      payload.password = hashPasswordForStorage(String(input.password));
    }

    const res: any = await amplifyClient.models.User.update(payload);
    if (res?.data) {
      writeAuditLog({
        userId: session.userId,
        action: "UPDATE",
        tableName: "User",
        recordId: Number(input.userId),
        oldValues: before
          ? {
              userId: Number(before.userId),
              username: before.username ?? null,
              accessLevel: before.accessLevel ?? null,
              firstName: before.firstName ?? null,
              lastName: before.lastName ?? null,
              email: before.email ?? null,
              isEnabled: before.isEnabled ?? null,
            }
          : undefined,
        newValues: {
          ...payload,
          passwordChanged: input.password !== undefined,
        },
      }).catch(() => {});

      return { success: true };
    }

    const msg = (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo actualizar el usuario";
    return { success: false, error: msg };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
