import { create } from "zustand";
import type { User, UserStatus } from "@/types";
import { avatarColorFor } from "@/lib/avatarColor";
import { getSocket } from "@/lib/socket";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  listFriendRequests,
  listFriends,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
  type ApiFriend,
  type ApiFriendRequest,
  type ApiPublicUser,
} from "@/lib/friends";

export interface FriendEntry {
  friendshipId: string;
  user: User;
  since: string;
}

export interface FriendRequestEntry {
  id: string;
  user: User;
  createdAt: string;
}

function toUser(api: ApiPublicUser): User {
  return { ...api, avatarColor: avatarColorFor(api.id) };
}

function toFriend(api: ApiFriend): FriendEntry {
  return {
    friendshipId: api.friendshipId,
    user: toUser(api.user),
    since: api.since,
  };
}

function toRequest(api: ApiFriendRequest): FriendRequestEntry {
  return { id: api.id, user: toUser(api.user), createdAt: api.createdAt };
}

interface FriendsState {
  friends: FriendEntry[];
  incomingRequests: FriendRequestEntry[];
  outgoingRequests: FriendRequestEntry[];
  isLoading: boolean;
  fetchAll: () => Promise<void>;
  sendRequest: (username: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
}

function patchFriendStatus(
  friends: FriendEntry[],
  userId: string,
  status: UserStatus,
): FriendEntry[] {
  let changed = false;
  const next = friends.map((entry) => {
    if (entry.user.id !== userId || entry.user.status === status) return entry;
    changed = true;
    return { ...entry, user: { ...entry.user, status } };
  });
  return changed ? next : friends;
}

export const useFriendsStore = create<FriendsState>((set, get) => {
  const socket = getSocket();

  socket.on(
    "user:status",
    ({ userId, status }: { userId: string; status: UserStatus }) => {
      set((state) => ({
        friends: patchFriendStatus(state.friends, userId, status),
      }));
    },
  );
  socket.on("user:online", ({ userId }: { userId: string }) => {
    set((state) => ({
      friends: patchFriendStatus(state.friends, userId, "ONLINE"),
    }));
  });
  socket.on("user:offline", ({ userId }: { userId: string }) => {
    set((state) => ({
      friends: patchFriendStatus(state.friends, userId, "OFFLINE"),
    }));
  });

  return {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    isLoading: false,

    fetchAll: async () => {
      set({ isLoading: true });
      try {
        const [friends, requests] = await Promise.all([
          listFriends(),
          listFriendRequests(),
        ]);
        set({
          friends: friends.map(toFriend),
          incomingRequests: requests.incoming.map(toRequest),
          outgoingRequests: requests.outgoing.map(toRequest),
        });
      } finally {
        set({ isLoading: false });
      }
    },

    sendRequest: async (username) => {
      await sendFriendRequest(username);
      await get().fetchAll();
    },

    acceptRequest: async (requestId) => {
      await acceptFriendRequest(requestId);
      await get().fetchAll();
    },

    rejectRequest: async (requestId) => {
      await rejectFriendRequest(requestId);
      set((state) => ({
        incomingRequests: state.incomingRequests.filter(
          (r) => r.id !== requestId,
        ),
      }));
    },

    cancelRequest: async (requestId) => {
      await cancelFriendRequest(requestId);
      set((state) => ({
        outgoingRequests: state.outgoingRequests.filter(
          (r) => r.id !== requestId,
        ),
      }));
    },

    removeFriend: async (userId) => {
      await removeFriend(userId);
      set((state) => ({
        friends: state.friends.filter((f) => f.user.id !== userId),
      }));
    },
  };
});
