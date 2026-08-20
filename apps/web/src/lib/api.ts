const rawApiUrl = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/**
 * HTTP API base. In production this is the site origin
 * (`https://unbound.maselcorp.com.br`); nginx forwards /auth, /users,
 * /uploads, /servers, … to Nest. There is no `/api` prefix.
 */
export const API_URL = rawApiUrl;

/**
 * Origin without a trailing `/api`, if one was set. Socket.IO must talk to
 * the host root (`io("…/api")` would be a namespace).
 */
export const PUBLIC_ORIGIN = rawApiUrl.replace(/\/api$/i, "");

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

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({}) as { message?: string });
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new ApiError(
      response.status,
      message ?? "Não foi possível completar a solicitação",
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
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

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => ({}) as { message?: string });
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message;
    throw new ApiError(
      response.status,
      message ?? "Não foi possível completar a solicitação",
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
