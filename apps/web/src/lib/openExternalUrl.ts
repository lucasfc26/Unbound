import { isTauri } from "@tauri-apps/api/core";
import { PUBLIC_APP_URL } from "./api";

const URL_TOKEN = /(https?:\/\/[^\s<>"']+)/gi;
const INVITE_HOSTS = new Set([
  "unbound.maselcorp.com.br",
  "www.unbound.maselcorp.com.br",
]);

function inviteHostnames(): Set<string> {
  const hosts = new Set(INVITE_HOSTS);
  try {
    const configured = new URL(PUBLIC_APP_URL).hostname.toLowerCase();
    if (configured && !configured.endsWith("tauri.localhost")) {
      hosts.add(configured);
    }
  } catch {
    // PUBLIC_APP_URL may be a relative/dev origin — production host still matches
  }
  return hosts;
}

/** `/invite/CODE` when the URL is an Unbound invite; otherwise null. */
export function unboundInviteRoute(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!inviteHostnames().has(parsed.hostname.toLowerCase())) return null;
    const match = parsed.pathname.match(/^\/invite\/([^/]+)\/?$/i);
    if (!match) return null;
    const code = decodeURIComponent(match[1]).trim();
    return code ? `/invite/${code}` : null;
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Opens http(s) links in the OS default browser (Tauri) or a new tab (web). */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isSafeHttpUrl(url)) return;
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function splitContentLinks(content: string): { text: string; href?: string }[] {
  const parts = content.split(URL_TOKEN);
  return parts.filter(Boolean).map((part) => {
    if (!/^https?:\/\//i.test(part)) return { text: part };
    const trimmed = part.replace(/[),.;!?]+$/g, "");
    const trailing = part.slice(trimmed.length);
    if (!isSafeHttpUrl(trimmed)) return { text: part };
    return { text: trimmed + trailing, href: trimmed };
  });
}
