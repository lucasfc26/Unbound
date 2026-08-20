import { create } from "zustand";
import type { User, UserStatus } from "@/types";
import { apiFetch, setAccessToken } from "@/lib/api";
import { avatarColorFor } from "@/lib/avatarColor";
import { getSocket } from "@/lib/socket";
import type { ApiPrivateUser } from "@/lib/account";
import {
  saveDesktopSession,
  loadDesktopSession,
  clearDesktopSession,
} from "@/lib/desktopSession";

type ApiUser = ApiPrivateUser;

interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
}

function toUser(apiUser: ApiUser): User {
  return { ...apiUser, avatarColor: avatarColorFor(apiUser.id) };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  bootstrap: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setStatus: (status: UserStatus) => void;
  updateUser: (apiUser: ApiUser) => void;
  /** For when the account itself was just deleted — there's no server session left to log out of. */
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const socket = getSocket();

  // A broadcast status of OFFLINE is always either someone else's real disconnect or our own
  // INVISIBLE masked for other viewers — never something to apply to our own live session, so
  // it's safe to ignore here without reintroducing the "invisible shows as offline to self" bug.
  socket.on(
    "user:status",
    ({ userId, status }: { userId: string; status: UserStatus }) => {
      const currentUser = get().user;
      if (currentUser && currentUser.id === userId && status !== "OFFLINE") {
        set({ user: { ...currentUser, status } });
      }
    },
  );

  return {
    user: null,
    isAuthenticated: false,
    isBootstrapping: true,

    bootstrap: async () => {
      try {
        const data = await apiFetch<AuthResponse>("/auth/refresh", {
          method: "POST",
        });
        setAccessToken(data.accessToken);
        await saveDesktopSession(data.refreshToken);
        getSocket().connect();
        set({
          user: toUser(data.user),
          isAuthenticated: true,
          isBootstrapping: false,
        });
      } catch {
        // The refresh_token cookie is either missing or invalid — on
        // desktop, fall back to whatever this app itself saved (WebView2
        // not always surviving a full app restart is exactly what this
        // covers). Plain web has no fallback store, so this is a no-op there.
        const stored = await loadDesktopSession();
        if (!stored) {
          setAccessToken(null);
          set({ user: null, isAuthenticated: false, isBootstrapping: false });
          return;
        }
        try {
          const data = await apiFetch<AuthResponse>("/auth/refresh", {
            method: "POST",
            body: { refreshToken: stored },
          });
          setAccessToken(data.accessToken);
          await saveDesktopSession(data.refreshToken);
          getSocket().connect();
          set({
            user: toUser(data.user),
            isAuthenticated: true,
            isBootstrapping: false,
          });
        } catch {
          await clearDesktopSession();
          setAccessToken(null);
          set({ user: null, isAuthenticated: false, isBootstrapping: false });
        }
      }
    },

    login: async (identifier, password) => {
      const data = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: { identifier, password },
      });
      setAccessToken(data.accessToken);
      await saveDesktopSession(data.refreshToken);
      getSocket().connect();
      set({ user: toUser(data.user), isAuthenticated: true });
    },

    register: async (input) => {
      const data = await apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: input,
      });
      setAccessToken(data.accessToken);
      await saveDesktopSession(data.refreshToken);
      getSocket().connect();
      set({ user: toUser(data.user), isAuthenticated: true });
    },

    logout: async () => {
      try {
        await apiFetch("/auth/logout", { method: "POST" });
      } finally {
        getSocket().disconnect();
        setAccessToken(null);
        await clearDesktopSession();
        set({ user: null, isAuthenticated: false });
      }
    },

    setStatus: (status) => {
      socket.emit("presence:set_status", { status });
      const currentUser = get().user;
      if (currentUser) set({ user: { ...currentUser, status } });
    },

    updateUser: (apiUser) => {
      set({ user: toUser(apiUser) });
    },

    clearSession: () => {
      getSocket().disconnect();
      setAccessToken(null);
      clearDesktopSession().catch(() => {});
      set({ user: null, isAuthenticated: false });
    },
  };
});
