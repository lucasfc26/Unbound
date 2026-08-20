import { create } from "zustand";
import type { User } from "@/types";
import { avatarColorFor } from "@/lib/avatarColor";
import { getSocket } from "@/lib/socket";
import { notifyDesktop } from "@/lib/desktop";
import { playNotificationSound } from "@/lib/notifySound";
import {
  listDms,
  markDmRead,
  openDm,
  type ApiDmConversation,
} from "@/lib/dms";
import type { ApiPublicUser } from "@/lib/friends";
import { useAuthStore } from "./useAuthStore";
import { useSettingsStore } from "./useSettingsStore";

export interface DmConversation {
  channelId: string;
  unreadCount: number;
  lastMessageAt: string | null;
  user: User;
}

interface ApiMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  author?: ApiPublicUser;
}

function toUser(api: ApiPublicUser): User {
  return { ...api, avatarColor: avatarColorFor(api.id) };
}

function toConversation(api: ApiDmConversation): DmConversation {
  return {
    channelId: api.channelId,
    unreadCount: api.unreadCount,
    lastMessageAt: api.lastMessageAt,
    user: toUser(api.user),
  };
}

interface DmState {
  conversations: DmConversation[];
  activeChannelId: string | null;
  fetchAll: () => Promise<void>;
  openWith: (userId: string) => Promise<DmConversation>;
  markRead: (channelId: string) => Promise<void>;
  setActiveChannelId: (channelId: string | null) => void;
  unreadCountForUser: (userId: string) => number;
  hasUnread: () => boolean;
}

export const useDmStore = create<DmState>((set, get) => {
  const socket = getSocket();

  socket.on("dm:message", (raw: ApiMessage) => {
    const me = useAuthStore.getState().user?.id;
    if (!me || raw.authorId === me) return;

    const viewing =
      get().activeChannelId === raw.channelId && !document.hidden;

    if (viewing) {
      void get().markRead(raw.channelId);
      return;
    }

    const settings = useSettingsStore.getState().settings;
    playNotificationSound();
    if ((settings?.desktopNotifications ?? true) && document.hidden) {
      notifyDesktop(
        raw.author?.displayName ?? "Nova mensagem",
        raw.content,
      );
    }

    set((state) => {
      const existing = state.conversations.find(
        (item) => item.channelId === raw.channelId,
      );
      if (existing) {
        return {
          conversations: state.conversations.map((item) =>
            item.channelId === raw.channelId
              ? {
                  ...item,
                  unreadCount: item.unreadCount + 1,
                  lastMessageAt: new Date().toISOString(),
                }
              : item,
          ),
        };
      }
      if (!raw.author) return state;
      return {
        conversations: [
          {
            channelId: raw.channelId,
            unreadCount: 1,
            lastMessageAt: new Date().toISOString(),
            user: toUser(raw.author),
          },
          ...state.conversations,
        ],
      };
    });
  });

  return {
    conversations: [],
    activeChannelId: null,

    fetchAll: async () => {
      const raw = await listDms();
      set({ conversations: raw.map(toConversation) });
    },

    openWith: async (userId) => {
      const conversation = toConversation(await openDm(userId));
      set((state) => {
        const others = state.conversations.filter(
          (item) => item.channelId !== conversation.channelId,
        );
        return { conversations: [conversation, ...others] };
      });
      return conversation;
    },

    markRead: async (channelId) => {
      await markDmRead(channelId);
      set((state) => ({
        conversations: state.conversations.map((item) =>
          item.channelId === channelId ? { ...item, unreadCount: 0 } : item,
        ),
      }));
    },

    setActiveChannelId: (channelId) => set({ activeChannelId: channelId }),

    unreadCountForUser: (userId) =>
      get().conversations.find((item) => item.user.id === userId)
        ?.unreadCount ?? 0,

    hasUnread: () => get().conversations.some((item) => item.unreadCount > 0),
  };
});
