"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import {
  DEFAULT_USER_UI_PREFERENCES,
  makeUserUiPreferencesKey,
  safeParseUserUiPreferences,
  type UserUiPreferences,
} from "@/lib/ui-preferences";

export async function getUserUiPreferences(): Promise<{ data?: UserUiPreferences; error?: string }> {
  noStore();
  const session = await requireSession();

  const name = makeUserUiPreferencesKey(session.userId);

  try {
    const res: any = await amplifyClient.models.ApplicationProperty.get({ name } as any);
    if (res?.data?.value !== undefined && res?.data?.value !== null) {
      return { data: safeParseUserUiPreferences(res.data.value) };
    }

    // Create defaults if missing
    const created: any = await amplifyClient.models.ApplicationProperty.create({
      name,
      value: JSON.stringify(DEFAULT_USER_UI_PREFERENCES),
    } as any);

    if (created?.data) return { data: DEFAULT_USER_UI_PREFERENCES };

    return { error: "No se pudieron cargar preferencias" };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}
