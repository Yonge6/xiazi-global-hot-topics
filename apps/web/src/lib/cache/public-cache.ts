export const CONTENT_REVALIDATE_SECONDS = 60;
export const CONTENT_STALE_WHILE_REVALIDATE_SECONDS = 300;
export const POSTER_REVALIDATE_SECONDS = 300;

export const CONTENT_CACHE_CONTROL =
  `public, max-age=0, s-maxage=${CONTENT_REVALIDATE_SECONDS}, stale-while-revalidate=${CONTENT_STALE_WHILE_REVALIDATE_SECONDS}`;

export const POSTER_CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";
export const POSTER_CDN_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400";

export function cachedFetchInit(
  revalidate: number,
  init: RequestInit = {},
): RequestInit & { next: { revalidate: number } } {
  return {
    ...init,
    cache: "force-cache",
    next: { revalidate },
  } as RequestInit & { next: { revalidate: number } };
}
