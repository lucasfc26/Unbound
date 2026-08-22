const rawApiUrl = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/**
 * HTTP API base. Production nginx routes /auth, /users, /uploads, … on the
 * site origin — there is no `/api` prefix. A trailing `/api` in VITE_API_URL
 * (e.g. leftover in the VPS compose file) is stripped so login does not 404.
 */
export const API_URL = rawApiUrl.replace(/\/api$/i, "");

/** Same host as the API; kept as an alias for Socket.IO / media. */
export const PUBLIC_ORIGIN = API_URL;

/**
 * The public web origin — used for links meant to be opened by someone else
 * (invite links, etc). `window.location.origin` is wrong for this under
 * Tauri: it resolves to `http://tauri.localhost`, which only means anything
 * inside that one desktop window. Falls back to the browser's own origin
 * when unset, which keeps plain-web/local dev working without config.
 */
export const PUBLIC_APP_URL =
  import.meta.env.VITE_PUBLIC_APP_URL ?? window.location.origin;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const AUTH_NO_REFRESH = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
]);

let accessToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInflight: Promise<boolean> | null = null;
let onAccessTokenRefreshed: (() => void) | null = null;

export function setOnAccessTokenRefreshed(callback: (() => void) | null) {
  onAccessTokenRefreshed = callback;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) scheduleAccessTokenRefresh(token);
  else clearAccessTokenRefresh();
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipRefresh?: boolean;
}

function throwIfFailed(
  status: number,
  payload: { message?: string | string[] },
): never {
  const message = Array.isArray(payload.message)
    ? payload.message.join(", ")
    : payload.message;
  throw new ApiError(
    status,
    message ?? "Não foi possível completar a solicitação",
  );
}

async function readErrorPayload(response: Response): Promise<{
  message?: string | string[];
}> {
  return response.json().catch(() => ({}) as { message?: string });
}

function readJwtExpiryMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function clearAccessTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/** Renew the access JWT ~1 minute before it dies so a long voice call
 *  does not suddenly 401 every REST call (settings, chat history, …). */
function scheduleAccessTokenRefresh(token: string) {
  clearAccessTokenRefresh();
  const expiresAt = readJwtExpiryMs(token);
  const delay = expiresAt
    ? Math.max(5_000, expiresAt - Date.now() - 60_000)
    : 12 * 60 * 1000;
  refreshTimer = setTimeout(() => {
    void refreshAccessToken();
  }, delay);
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    const { loadDesktopSession, saveDesktopSession } = await import(
      "./desktopSession"
    );
    const stored = await loadDesktopSession();
    try {
      const data = await apiFetch<{
        accessToken: string;
        refreshToken: string;
      }>("/auth/refresh", {
        method: "POST",
        body: stored ? { refreshToken: stored } : undefined,
        skipRefresh: true,
      });
      setAccessToken(data.accessToken);
      await saveDesktopSession(data.refreshToken);
      onAccessTokenRefreshed?.();
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInflight = null;
  });
  return refreshInflight;
}

async function recoverFromUnauthorized(path: string): Promise<boolean> {
  if (AUTH_NO_REFRESH.has(path)) return false;
  return refreshAccessToken();
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { skipRefresh, body, headers: inputHeaders, ...rest } = options;
  const headers = new Headers(inputHeaders);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !skipRefresh) {
    const recovered = await recoverFromUnauthorized(path);
    if (recovered) {
      return apiFetch<T>(path, { ...options, skipRefresh: true });
    }
  }

  if (!response.ok) {
    throwIfFailed(response.status, await readErrorPayload(response));
  }

  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, "Resposta inválida do servidor");
  }
}

export async function apiUpload<T>(
  path: string,
  file: File,
  didRefresh = false,
): Promise<T> {
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    credentials: "include",
    body,
  });

  if (response.status === 401 && !didRefresh) {
    const recovered = await recoverFromUnauthorized(path);
    if (recovered) return apiUpload<T>(path, file, true);
  }

  if (!response.ok) {
    throwIfFailed(response.status, await readErrorPayload(response));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
