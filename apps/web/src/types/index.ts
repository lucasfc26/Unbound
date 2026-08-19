export type UserStatus =
  "ONLINE" | "IDLE" | "DO_NOT_DISTURB" | "INVISIBLE" | "OFFLINE";

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl: string | null;
  avatarColor: string;
  status: UserStatus;
  customStatus?: string;
  bio?: string;
  createdAt: string;
}

export type ServerRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";

export interface ServerMember {
  userId: string;
  serverId: string;
  role: ServerRole;
  joinedAt: string;
}

export interface Server {
  id: string;
  name: string;
  description?: string;
  iconUrl: string | null;
  iconColor: string;
  ownerId: string;
  createdAt: string;
}

export type ChannelType = "TEXT" | "VOICE";

export interface ChannelCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface Channel {
  id: string;
  serverId: string;
  categoryId: string | null;
  name: string;
  type: ChannelType;
  topic?: string;
  position: number;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToId?: string | null;
  linkPreview?: LinkPreview | null;
  author?: User;
}

export interface LinkPreview {
  url: string;
  siteName: string;
  title: string;
  description?: string;
  domain: string;
}

export type FriendshipStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED";

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
}

export interface Invitation {
  id: string;
  code: string;
  serverId: string;
  creatorId: string;
  createdAt: string;
  expiresAt?: string | null;
  maxUses?: number | null;
  uses: number;
}
