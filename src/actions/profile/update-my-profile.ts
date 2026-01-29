"use server";

import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { hashPasswordForStorage } from "@/services/auth-service";
import { writeAuditLog } from "@/services/audit-log-service";

const UpdateMyProfileSchema = z
  .object({
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    email: z.string().trim().email().max(120).optional(),
    password: z.string().min(6).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No hay cambios" });

export type UpdateMyProfileInput = z.infer<typeof UpdateMyProfileSchema>;

export async function updateMyProfileAction(
  raw: UpdateMyProfileInput
): Promise<{ success: boolean; error?: string }> {
  noStore();

  try {
    const session = await requireSession();

    const parsed = UpdateMyProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues?.[0]?.message ?? "Datos inválidos" };
    }

    const patch = parsed.data;

    // Load current values for audit.
    const userRes: any = await amplifyClient.models.User.get({ userId: Number(session.userId) } as any);
    const before = (userRes?.data ?? {}) as any;

    const userUpdate: any = {
      userId: Number(session.userId),
      ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
      ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.password !== undefined ? { password: hashPasswordForStorage(patch.password) } : {}),
    };

    await amplifyClient.models.User.update(userUpdate);

    // Keep active session record in sync (used by getCurrentSession())
    const sessionUpdate: any = {
      userId: Number(session.userId),
      ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
      ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
    };
    await amplifyClient.models.SessionConfig.update(sessionUpdate);

    // Best-effort audit
    writeAuditLog({
      userId: Number(session.userId),
      action: "UPDATE",
      tableName: "User",
      recordId: Number(session.userId),
      oldValues: {
        firstName: before?.firstName ?? null,
        lastName: before?.lastName ?? null,
        email: before?.email ?? null,
      },
      newValues: {
        ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
        ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.password !== undefined ? { password: "***" } : {}),
      },
    }).catch(() => {});

    return { success: true };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
