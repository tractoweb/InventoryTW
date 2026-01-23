import { z } from "zod";

export const UserUiPreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("light"),
  enableAnimeJs: z.boolean().default(false),
  animationPreset: z.enum(["standard", "show"]).default("standard"),
  enableDecor: z.boolean().default(false),
  decorStyle: z.enum(["floral", "emoji", "stickers", "flowerRing"]).default("floral"),
  decorIntensity: z.coerce.number().min(0).max(1).default(0.35),
  decorAccentHex: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, "Color inválido")
    .optional()
    .nullable(),
  primaryColorHex: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, "Color inválido")
    .optional()
    .nullable(),
  radiusRem: z.coerce.number().min(0).max(2).default(0.5),
  fontScale: z.coerce.number().min(0.85).max(1.25).default(1),
});

export type UserUiPreferences = z.infer<typeof UserUiPreferencesSchema>;

export const DEFAULT_USER_UI_PREFERENCES: UserUiPreferences = {
  theme: "light",
  enableAnimeJs: false,
  animationPreset: "standard",
  enableDecor: false,
  decorStyle: "floral",
  decorIntensity: 0.35,
  decorAccentHex: "#F2C94C",
  primaryColorHex: null,
  radiusRem: 0.5,
  fontScale: 1,
};

const USER_UI_PREFERENCES_PROPERTY_PREFIX = "uiPreferences:user:";

export function makeUserUiPreferencesKey(userId: number): string {
  return `${USER_UI_PREFERENCES_PROPERTY_PREFIX}${Number(userId)}`;
}

export function safeParseUserUiPreferences(raw: unknown): UserUiPreferences {
  if (typeof raw !== "string" || raw.trim().length === 0) return DEFAULT_USER_UI_PREFERENCES;

  try {
    const json = JSON.parse(raw);
    const parsed = UserUiPreferencesSchema.safeParse(json);
    return parsed.success ? parsed.data : DEFAULT_USER_UI_PREFERENCES;
  } catch {
    return DEFAULT_USER_UI_PREFERENCES;
  }
}
