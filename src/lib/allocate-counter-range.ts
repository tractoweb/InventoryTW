import { amplifyClient } from "@/lib/amplify-config";

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
