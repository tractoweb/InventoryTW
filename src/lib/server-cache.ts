import { unstable_cache } from "next/cache";

export type CacheConfig = {
  keyParts: string[];
  revalidateSeconds: number;
  tags?: string[];
};

export function cached<T>(fn: () => Promise<T>, config: CacheConfig): () => Promise<T> {
  return unstable_cache(fn, config.keyParts, {
    revalidate: config.revalidateSeconds,
    tags: config.tags,
  });
}
