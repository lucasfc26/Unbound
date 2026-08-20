import { API_URL } from "./api";

/** Turns a stored avatar path (`/uploads/...`) into a URL the browser can load. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("/")) return `${API_URL}${url}`;
  return url;
}
