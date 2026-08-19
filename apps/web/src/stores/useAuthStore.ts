import { create } from "zustand";
import type { User, UserStatus } from "@/types";
import { apiFetch, setAccessToken } from "@/lib/api";
import { avatarColorFor } from "@/lib/avatarColor";
import { getSocket } from "@/lib/socket";

interface ApiUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: User["status"];
  createdAt: string;
}

interface AuthResponse {
  user: ApiUser;
  accessToken: string;
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
        getSocket().connect();
        set({
          user: toUser(data.user),
          isAuthenticated: true,
          isBootstrapping: false,
        });
      } catch {
        setAccessToken(null);
        set({ user: null, isAuthenticated: false, isBootstrapping: false });
      }
    },

    login: async (identifier, password) => {
      const data = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: { identifier, password },
      });
      setAccessToken(data.accessToken);
      getSocket().connect();
      set({ user: toUser(data.user), isAuthenticated: true });
    },

    register: async (input) => {
      const data = await apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: input,
      });
      setAccessToken(data.accessToken);
      getSocket().connect();
      set({ user: toUser(data.user), isAuthenticated: true });
    },

    logout: async () => {
      try {
        await apiFetch("/auth/logout", { method: "POST" });
      } finally {
        getSocket().disconnect();
        setAccessToken(null);
        set({ user: null, isAuthenticated: false });
      }
    },

    setStatus: (status) => {
      socket.emit("presence:set_status", { status });
      const currentUser = get().user;
      if (currentUser) set({ user: { ...currentUser, status } });
    },
  };
});
