// Tauri's production build is served from a fixed custom-protocol origin, not from
// FRONTEND_URL — always allow it alongside whatever's configured, since it's inherent
// to how the desktop app works, not something a self-hoster needs to opt into.
const TAURI_ORIGINS = [
  'tauri://localhost',
  'https://tauri.localhost',
  // Windows WebView2 (Tauri 2 default) — without this, login from the
  // installed .exe is a CORS failure that the UI shows as "could not connect".
  'http://tauri.localhost',
];

export function resolveAllowedOrigins(
  configured: string | undefined,
): string[] {
  const fromConfig = (configured ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set([...fromConfig, ...TAURI_ORIGINS])];
}
