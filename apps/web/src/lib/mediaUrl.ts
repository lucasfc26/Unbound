import { API_URL } from "./api";

/**
 * Turns a stored path (`/uploads/icons/….webp`) into a URL the browser can
 * load. Same origin as the API; nginx must proxy `/uploads/` to the backend.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("/")) return `${API_URL}${url}`;
  return url;
}
