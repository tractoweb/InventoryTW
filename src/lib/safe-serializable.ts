export type PlainJson =
  | null
  | boolean
  | number
  | string
  | PlainJson[]
  | { [key: string]: PlainJson };

export function toPlainJson<T extends Record<string, any>>(obj: T, keys: (keyof T)[]): Record<string, PlainJson> {
  const out: Record<string, PlainJson> = {};
  for (const key of keys) {
    const value = obj?.[key];
    if (value === undefined) continue;
    if (typeof value === "function") continue;
    out[String(key)] = value as PlainJson;
  }
  return out;
}
