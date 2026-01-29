import { amplifyClient } from "@/lib/amplify-server";

/**
 * Allocates a contiguous range of numeric IDs using the `Counter` model.
 * Returns an array with `count` IDs: (current+1 .. current+count).
 */
export async function allocateCounterRange(counterName: string, count: number): Promise<number[]> {
  const { data: existing } = await amplifyClient.models.Counter.get({ name: counterName });
  const current = existing ? Number((existing as any).value ?? 0) : 0;
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const nextValue = safeCurrent + count;

  if (!existing) {
    await amplifyClient.models.Counter.create({ name: counterName, value: nextValue });
  } else {
    await amplifyClient.models.Counter.update({ name: counterName, value: nextValue });
  }

  return Array.from({ length: count }, (_, idx) => safeCurrent + idx + 1);
}

/**
 * Ensures the counter is at least `minValue` (useful when importing data that already has IDs).
 */
export async function ensureCounterAtLeast(counterName: string, minValue: number): Promise<void> {
  const safeMin = Number.isFinite(minValue) ? Math.max(0, Math.trunc(minValue)) : 0;
  const { data: existing } = await amplifyClient.models.Counter.get({ name: counterName });
  const current = existing ? Number((existing as any).value ?? 0) : 0;
  const safeCurrent = Number.isFinite(current) ? current : 0;

  if (!existing) {
    await amplifyClient.models.Counter.create({ name: counterName, value: safeMin });
    return;
  }

  if (safeCurrent < safeMin) {
    await amplifyClient.models.Counter.update({ name: counterName, value: safeMin });
  }
}
