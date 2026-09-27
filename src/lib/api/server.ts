import "server-only";

import { API_URL, normalizeUploadedMedia } from "./client";

// Server Components can use the private Docker/network address while browsers
// keep using the public same-origin `/api` endpoint.
const SERVER_API_URL = (process.env.API_INTERNAL_URL ?? API_URL).replace(/\/+$/, "");

/** Fetches fresh API data for Server Components on every request. */
export async function serverFetch<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${SERVER_API_URL}${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return normalizeUploadedMedia((await response.json()) as T);
  } catch {
    return null;
  }
}
