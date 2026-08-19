import { create } from "zustand";
import type { LinkPreview, Message, User, UserStatus } from "@/types";
import { apiFetch } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { avatarColorFor } from "@/lib/avatarColor";
import { notifyDesktop } from "@/lib/desktop";
import { useAuthStore } from "./useAuthStore";

interface ApiPublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: string;
}

interface ApiMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  linkPreview: LinkPreview | null;
  author: ApiPublicUser;
}

interface TypingUser {
  userId: string;
  displayName: string;
}

function toUser(api: ApiPublicUser): User {
  return { ...api, avatarColor: avatarColorFor(api.id) };
}

function toMessage(api: ApiMessage): Message {
  return {
    id: api.id,
    channelId: api.channelId,
    authorId: api.authorId,
    content: api.content,
    createdAt: api.createdAt,
    editedAt: api.editedAt,
    linkPreview: api.linkPreview,
    author: toUser(api.author),
  };
}

const PAGE_SIZE = 50;

interface ChatState {
  messagesByChannel: Record<string, Message[]>;
  typingByChannel: Record<string, TypingUser[]>;
  hasMoreByChannel: Record<string, boolean>;
  loadingByChannel: Record<string, boolean>;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  loadHistory: (channelId: string) => Promise<void>;
  loadMore: (channelId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => {
  const socket = getSocket();

  socket.on("message:create", (raw: ApiMessage) => {
    const message = toMessage(raw);
    set((state) => {
      const list = state.messagesByChannel[message.channelId] ?? [];
      if (list.some((item) => item.id === message.id)) return state;
      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [message.channelId]: [...list, message],
        },
      };
    });

    const isOwnMessage = message.authorId === useAuthStore.getState().user?.id;
    if (!isOwnMessage && document.hidden) {
      notifyDesktop(
        message.author?.displayName ?? "Nova mensagem",
        message.content,
      );
    }
  });

  socket.on("message:update", (raw: ApiMessage) => {
    const message = toMessage(raw);
    set((state) => ({
      messagesByChannel: {
        ...state.messagesByChannel,
        [message.channelId]: (
          state.messagesByChannel[message.channelId] ?? []
        ).map((item) => (item.id === message.id ? message : item)),
      },
    }));
  });

  socket.on(
    "message:delete",
    ({ id, channelId }: { id: string; channelId: string }) => {
      set((state) => ({
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: (state.messagesByChannel[channelId] ?? []).filter(
            (item) => item.id !== id,
          ),
        },
      }));
    },
  );

  socket.on(
    "typing:start",
    ({
      channelId,
      userId,
      displayName,
    }: TypingUser & { channelId: string }) => {
      set((state) => {
        const current = state.typingByChannel[channelId] ?? [];
        if (current.some((user) => user.userId === userId)) return state;
        return {
          typingByChannel: {
            ...state.typingByChannel,
            [channelId]: [...current, { userId, displayName }],
          },
        };
      });
    },
  );

  socket.on(
    "typing:stop",
    ({ channelId, userId }: { channelId: string; userId: string }) => {
      set((state) => ({
        typingByChannel: {
          ...state.typingByChannel,
          [channelId]: (state.typingByChannel[channelId] ?? []).filter(
            (user) => user.userId !== userId,
          ),
        },
      }));
    },
  );

  return {
    messagesByChannel: {},
    typingByChannel: {},
    hasMoreByChannel: {},
    loadingByChannel: {},

    joinChannel: (channelId) => socket.emit("channel:join", { channelId }),
    leaveChannel: (channelId) => socket.emit("channel:leave", { channelId }),

    loadHistory: async (channelId) => {
      set((state) => ({
        loadingByChannel: { ...state.loadingByChannel, [channelId]: true },
      }));
      try {
        const raw = await apiFetch<ApiMessage[]>(
          `/channels/${channelId}/messages?limit=${PAGE_SIZE}`,
        );
        set((state) => ({
          messagesByChannel: {
            ...state.messagesByChannel,
            [channelId]: raw.map(toMessage),
          },
          hasMoreByChannel: {
            ...state.hasMoreByChannel,
            [channelId]: raw.length === PAGE_SIZE,
          },
        }));
      } finally {
        set((state) => ({
          loadingByChannel: { ...state.loadingByChannel, [channelId]: false },
        }));
      }
    },

    loadMore: async (channelId) => {
      const existing = get().messagesByChannel[channelId] ?? [];
      const oldest = existing[0];
      if (!oldest || get().loadingByChannel[channelId]) return;

      set((state) => ({
        loadingByChannel: { ...state.loadingByChannel, [channelId]: true },
      }));
      try {
        const raw = await apiFetch<ApiMessage[]>(
          `/channels/${channelId}/messages?limit=${PAGE_SIZE}&before=${oldest.id}`,
        );
        set((state) => ({
          messagesByChannel: {
            ...state.messagesByChannel,
            [channelId]: [
              ...raw.map(toMessage),
              ...(state.messagesByChannel[channelId] ?? []),
            ],
          },
          hasMoreByChannel: {
            ...state.hasMoreByChannel,
            [channelId]: raw.length === PAGE_SIZE,
          },
        }));
      } finally {
        set((state) => ({
          loadingByChannel: { ...state.loadingByChannel, [channelId]: false },
        }));
      }
    },

    sendMessage: (channelId, content) =>
      socket.emit("message:create", { channelId, content }),
    editMessage: (messageId, content) =>
      socket.emit("message:update", { messageId, content }),
    deleteMessage: (messageId) => socket.emit("message:delete", { messageId }),
    startTyping: (channelId) => socket.emit("typing:start", { channelId }),
    stopTyping: (channelId) => socket.emit("typing:stop", { channelId }),
  };
});
