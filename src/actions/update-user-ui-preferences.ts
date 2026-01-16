"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import {
  UserUiPreferencesSchema,
  makeUserUiPreferencesKey,
  type UserUiPreferences,
} from "@/lib/ui-preferences";

export type UpdateUserUiPreferencesInput = z.input<typeof UserUiPreferencesSchema>;

export async function updateUserUiPreferencesAction(
  raw: UpdateUserUiPreferencesInput
): Promise<{ success: boolean; data?: UserUiPreferences; error?: string }> {
  noStore();
  const session = await requireSession();

  const parsed = UserUiPreferencesSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  const name = makeUserUiPreferencesKey(session.userId);

  try {
    const existing: any = await amplifyClient.models.ApplicationProperty.get({ name } as any).catch(() => null);

    const payload: any = {
      name,
      value: JSON.stringify(parsed.data),
    };

    const res: any = existing?.data
      ? await amplifyClient.models.ApplicationProperty.update(payload)
      : await amplifyClient.models.ApplicationProperty.create(payload);

    if (res?.data) return { success: true, data: parsed.data };

    const msg = (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo guardar";
    return { success: false, error: msg };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
