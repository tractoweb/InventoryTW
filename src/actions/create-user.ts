"use server";

import { amplifyClient } from "@/lib/amplify-config";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";
import { hashPasswordForStorage } from "@/services/auth-service";
import { writeAuditLog } from "@/services/audit-log-service";

export interface CreateUserInput {
  username: string;
  password: string;
  accessLevel?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  isEnabled?: boolean;
}

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

    const normalizedUsername = String(input.username).trim();
    const normalizedPassword = String(input.password);
    const normalizedEmail = input.email?.trim();
    const normalizedFirstName = input.firstName?.trim();
    const normalizedLastName = input.lastName?.trim();

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

    return { success: true, user: result.data };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear usuario" };
  }
}
