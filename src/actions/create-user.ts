"use server";

import { amplifyClient } from "@/lib/amplify-config";

export interface CreateUserInput {
  username: string;
  password: string;
  accessLevel?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  isEnabled?: boolean;
}

export async function createUser(input: CreateUserInput) {
  try {
    const result = await amplifyClient.models.User.create({
      username: input.username,
      password: input.password,
      accessLevel: input.accessLevel ?? 0,
      firstName: input.firstName ?? "",
      lastName: input.lastName ?? "",
      email: input.email ?? "",
      isEnabled: input.isEnabled ?? true,
    });
    return { success: true, user: result.data };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear usuario" };
  }
}
