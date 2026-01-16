let animePromise: Promise<any> | null = null;

export async function getAnime(): Promise<any> {
  if (!animePromise) {
    animePromise = import("animejs").then((m: any) => m?.default ?? m);
  }
  return animePromise;
}
