import { isTauri } from "@tauri-apps/api/core";

const STORE_FILE = "session.json";
const KEY = "refreshToken";

/**
 * Explicit, app-controlled fallback for "stay logged in" on desktop —
 * independent of the WebView2 cookie jar the primary refresh_token cookie
 * relies on. Both paths carry the same value (the server already sends it
 * in both Set-Cookie and the response body on every login/register/refresh),
 * this just gives bootstrap() a second way to recover a session if the
 * cookie didn't survive an app restart.
 */
async function getStore() {
  const { load } = await import("@tauri-apps/plugin-store");
  return load(STORE_FILE, { autoSave: true });
}

export async function saveDesktopSession(refreshToken: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    await store.set(KEY, refreshToken);
  } catch {
    // best-effort — the cookie-based session still works without this
  }
}

export async function loadDesktopSession(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const store = await getStore();
    const value = await store.get<string>(KEY);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function clearDesktopSession(): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    await store.delete(KEY);
  } catch {
    // nothing to clean up
  }
}
