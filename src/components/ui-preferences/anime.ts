let animePromise: Promise<any> | null = null;

export async function getAnime(): Promise<any> {
  if (!animePromise) {
    animePromise = import("animejs").then((m: any) => m);
  }
  return animePromise;
}
