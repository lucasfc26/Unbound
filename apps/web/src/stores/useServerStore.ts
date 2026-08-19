import { create } from "zustand";
import type {
  Channel,
  ChannelCategory,
  ChannelType,
  Server,
  ServerRole,
  User,
  UserStatus,
} from "@/types";
import { getSocket } from "@/lib/socket";
import {
  createServer,
  deleteServer,
  leaveServer,
  listMembers,
  listServers,
  updateServer,
  type ApiServer,
  type ApiServerMember,
} from "@/lib/servers";
import {
  createCategory as apiCreateCategory,
  createChannel as apiCreateChannel,
  listCategories,
  listChannels,
  type ApiChannel,
  type ApiChannelCategory,
} from "@/lib/channels";
import { avatarColorFor } from "@/lib/avatarColor";

interface CreateServerInput {
  name: string;
  description?: string;
  iconColor?: string;
}

interface UpdateServerInput {
  name?: string;
  description?: string;
  iconColor?: string;
}

interface CreateCategoryInput {
  serverId: string;
  name: string;
}

interface CreateChannelInput {
  serverId: string;
  categoryId: string | null;
  name: string;
  type: ChannelType;
}

export interface ServerMemberEntry {
  userId: string;
  role: ServerRole;
  user: User;
}

interface ServerState {
  servers: Server[];
  categories: ChannelCategory[];
  channels: Channel[];
  membersByServer: Record<string, ServerMemberEntry[]>;
  fetchServers: () => Promise<void>;
  fetchMembers: (serverId: string) => Promise<void>;
  fetchChannels: (serverId: string) => Promise<void>;
  addServer: (input: CreateServerInput) => Promise<Server>;
  updateServerInfo: (
    serverId: string,
    input: UpdateServerInput,
  ) => Promise<void>;
  deleteServer: (serverId: string, password: string) => Promise<void>;
  leaveServer: (serverId: string) => Promise<void>;
  addCategory: (input: CreateCategoryInput) => Promise<ChannelCategory>;
  addChannel: (input: CreateChannelInput) => Promise<Channel>;
}

function toServer(api: ApiServer): Server {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? undefined,
    iconUrl: api.iconUrl,
    iconColor: api.iconColor,
    ownerId: api.ownerId,
    createdAt: api.createdAt,
  };
}

function toCategory(api: ApiChannelCategory): ChannelCategory {
  return {
    id: api.id,
    serverId: api.serverId,
    name: api.name,
    position: api.position,
  };
}

function toChannel(api: ApiChannel): Channel {
  return {
    id: api.id,
    serverId: api.serverId,
    categoryId: api.categoryId,
    name: api.name,
    type: api.type,
    topic: api.topic ?? undefined,
    position: api.position,
  };
}

function toMemberEntry(api: ApiServerMember): ServerMemberEntry {
  return {
    userId: api.userId,
    role: api.role,
    user: {
      id: api.user.id,
      username: api.user.username,
      displayName: api.user.displayName,
      email: api.user.email,
      avatarUrl: api.user.avatarUrl,
      avatarColor: avatarColorFor(api.user.id),
      status: api.user.status,
      createdAt: api.user.createdAt,
    },
  };
}

function patchMemberStatus(
  membersByServer: Record<string, ServerMemberEntry[]>,
  userId: string,
  status: UserStatus,
): Record<string, ServerMemberEntry[]> {
  let changed = false;
  const next: Record<string, ServerMemberEntry[]> = {};
  for (const [serverId, entries] of Object.entries(membersByServer)) {
    next[serverId] = entries.map((entry) => {
      if (entry.userId !== userId || entry.user.status === status) return entry;
      changed = true;
      return { ...entry, user: { ...entry.user, status } };
    });
  }
  return changed ? next : membersByServer;
}

export const useServerStore = create<ServerState>((set) => {
  const socket = getSocket();

  socket.on(
    "user:status",
    ({ userId, status }: { userId: string; status: UserStatus }) => {
      set((state) => ({
        membersByServer: patchMemberStatus(
          state.membersByServer,
          userId,
          status,
        ),
      }));
    },
  );
  socket.on("user:online", ({ userId }: { userId: string }) => {
    set((state) => ({
      membersByServer: patchMemberStatus(
        state.membersByServer,
        userId,
        "ONLINE",
      ),
    }));
  });
  socket.on("user:offline", ({ userId }: { userId: string }) => {
    set((state) => ({
      membersByServer: patchMemberStatus(
        state.membersByServer,
        userId,
        "OFFLINE",
      ),
    }));
  });

  socket.on("channel:create", (raw: ApiChannel) => {
    const channel = toChannel(raw);
    set((state) =>
      state.channels.some((item) => item.id === channel.id)
        ? state
        : { channels: [...state.channels, channel] },
    );
  });
  socket.on("channel:update", (raw: ApiChannel) => {
    const channel = toChannel(raw);
    set((state) => ({
      channels: state.channels.map((item) =>
        item.id === channel.id ? channel : item,
      ),
    }));
  });
  socket.on("channel:delete", ({ id }: { id: string; serverId: string }) => {
    set((state) => ({
      channels: state.channels.filter((item) => item.id !== id),
    }));
  });
  socket.on(
    "channel:reorder",
    ({ serverId, channels }: { serverId: string; channels: ApiChannel[] }) => {
      set((state) => ({
        channels: [
          ...state.channels.filter((item) => item.serverId !== serverId),
          ...channels.map(toChannel),
        ],
      }));
    },
  );

  socket.on("category:create", (raw: ApiChannelCategory) => {
    const category = toCategory(raw);
    set((state) =>
      state.categories.some((item) => item.id === category.id)
        ? state
        : { categories: [...state.categories, category] },
    );
  });
  socket.on("category:update", (raw: ApiChannelCategory) => {
    const category = toCategory(raw);
    set((state) => ({
      categories: state.categories.map((item) =>
        item.id === category.id ? category : item,
      ),
    }));
  });
  socket.on("category:delete", ({ id }: { id: string; serverId: string }) => {
    set((state) => ({
      categories: state.categories.filter((item) => item.id !== id),
    }));
  });
  socket.on(
    "category:reorder",
    ({
      serverId,
      categories,
    }: {
      serverId: string;
      categories: ApiChannelCategory[];
    }) => {
      set((state) => ({
        categories: [
          ...state.categories.filter((item) => item.serverId !== serverId),
          ...categories.map(toCategory),
        ],
      }));
    },
  );

  return {
    servers: [],
    categories: [],
    channels: [],
    membersByServer: {},

    fetchServers: async () => {
      const apiServers = await listServers();
      set({ servers: apiServers.map(toServer) });
    },

    fetchMembers: async (serverId) => {
      const members = await listMembers(serverId);
      set((state) => ({
        membersByServer: {
          ...state.membersByServer,
          [serverId]: members.map(toMemberEntry),
        },
      }));
    },

    fetchChannels: async (serverId) => {
      const [apiCategories, apiChannels] = await Promise.all([
        listCategories(serverId),
        listChannels(serverId),
      ]);
      set((state) => ({
        categories: [
          ...state.categories.filter(
            (category) => category.serverId !== serverId,
          ),
          ...apiCategories.map(toCategory),
        ],
        channels: [
          ...state.channels.filter((channel) => channel.serverId !== serverId),
          ...apiChannels.map(toChannel),
        ],
      }));
    },

    addServer: async ({ name, description, iconColor }) => {
      const created = await createServer({ name, description, iconColor });
      const server = toServer(created);
      set((state) => ({ servers: [...state.servers, server] }));
      return server;
    },

    updateServerInfo: async (serverId, input) => {
      const updated = await updateServer(serverId, input);
      const server = toServer(updated);
      set((state) => ({
        servers: state.servers.map((item) =>
          item.id === serverId ? server : item,
        ),
      }));
    },

    deleteServer: async (serverId, password) => {
      await deleteServer(serverId, password);
      set((state) => ({
        servers: state.servers.filter((server) => server.id !== serverId),
      }));
    },

    leaveServer: async (serverId) => {
      await leaveServer(serverId);
      set((state) => ({
        servers: state.servers.filter((server) => server.id !== serverId),
      }));
    },

    addCategory: async ({ serverId, name }) => {
      const created = await apiCreateCategory(serverId, name);
      const category = toCategory(created);
      // The channel:create broadcast (see socket.on("category:create") above) can arrive
      // before or after this REST response resolves, so both paths must dedup by id.
      set((state) =>
        state.categories.some((item) => item.id === category.id)
          ? state
          : { categories: [...state.categories, category] },
      );
      return category;
    },

    addChannel: async ({ serverId, categoryId, name, type }) => {
      const created = await apiCreateChannel(serverId, {
        name,
        type,
        categoryId,
      });
      const channel = toChannel(created);
      // Same race as addCategory above: the channel:create broadcast can win the race.
      set((state) =>
        state.channels.some((item) => item.id === channel.id)
          ? state
          : { channels: [...state.channels, channel] },
      );
      return channel;
    },
  };
});
