"use server";

import { amplifyClient } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

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
    const normalizedUsername = String(input.username).trim();
    const normalizedPassword = String(input.password);
    const normalizedEmail = input.email?.trim();
    const normalizedFirstName = input.firstName?.trim();
    const normalizedLastName = input.lastName?.trim();

    const userId = await getNextUserId();

    const result = await amplifyClient.models.User.create({
      userId,
      username: normalizedUsername,
      password: normalizedPassword,
      accessLevel: input.accessLevel ?? 0,
      firstName: normalizedFirstName || undefined,
      lastName: normalizedLastName || undefined,
      email: normalizedEmail ? normalizedEmail : undefined,
      isEnabled: input.isEnabled ?? true,
    });

    return { success: true, user: result.data };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear usuario" };
  }
}
