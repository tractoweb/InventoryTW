type AnimeModule = typeof import("animejs");

let animePromise: Promise<AnimeModule | null> | null = null;

/**
 * Fail-safe loader: returns null if AnimeJS is unavailable or import fails.
 * This ensures the app never crashes due to missing/changed AnimeJS.
 */
export async function getAnime(): Promise<AnimeModule | null> {
  if (!animePromise) {
    animePromise = import("animejs")
      .then((m) => m as AnimeModule)
      .catch(() => null);
  }
  return animePromise;
}
