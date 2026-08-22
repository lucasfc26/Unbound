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
  customStatus?: string | null;
  bio?: string | null;
  // Only ever populated for the authenticated user's own profile — never sent for other users.
  friendCode?: string;
  pronouns?: string | null;
  createdAt: string;
}

export type FriendRequestPrivacy = "EVERYONE" | "NOBODY";

export type NoiseSuppressionMode = "auto" | "manual";

export type MediaProfile = "quality" | "gaming";
export type BroadcastMode = "auto" | "manual";
export type BroadcastResolution = "480p" | "720p" | "1080p" | "native";
export type BroadcastCodec = "auto" | "vp8" | "vp9" | "h264";
export type BroadcastTransport = "auto" | "p2p" | "sfu";

export interface Keybind {
  code: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export type KeybindAction =
  | "toggleMute"
  | "toggleDeafen"
  | "pushToTalk"
  | "toggleCamera"
  | "toggleScreenShare"
  | "leaveCall"
  | "openSettings"
  | "toggleNoiseSuppression";

export type ThemePreference = "dark" | "light" | "system";
export type DensityPreference = "compact" | "normal" | "comfortable";

export interface UserSettings {
  bio: string | null;
  pronouns: string | null;
  customStatus: string | null;
  friendRequestPrivacy: FriendRequestPrivacy;
  shareTypingStatus: boolean;
  desktopNotifications: boolean;
  notificationSound: boolean;
  theme: ThemePreference;
  density: DensityPreference;
  micGain: number;
  outputGain: number;
  noiseSuppressionMode: NoiseSuppressionMode;
  noiseGate: number;
  pushToTalkEnabled: boolean;
  keybinds: Partial<Record<KeybindAction, Keybind | null>>;
  mediaProfile: MediaProfile;
  broadcastMode: BroadcastMode;
  broadcastResolution: BroadcastResolution;
  broadcastMaxBitrateKbps: number;
  broadcastFps: number;
  broadcastCodec: BroadcastCodec;
  broadcastTransport: BroadcastTransport;
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
