import { API_URL } from "./api";

/**
 * Turns a stored path (`/uploads/icons/….webp`) into a URL the browser can
 * load. Production nginx only forwards `/api/…` to Nest, so we prefix with
 * `API_URL` (which already includes `/api` there). A request to
 * `/uploads/…` on the site origin hits the frontend and shows a broken image.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("/")) return `${API_URL}${url}`;
  return url;
}

/** Turns a stored avatar path (`/uploads/...`) into a URL the browser can load. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("/")) return `${PUBLIC_ORIGIN}${url}`;
  return url;
}
