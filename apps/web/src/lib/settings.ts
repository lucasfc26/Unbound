import { apiFetch } from "./api";
import { DEFAULT_KEYBINDS } from "./keybinds";
import type {
  FriendRequestPrivacy,
  Keybind,
  KeybindAction,
  NoiseSuppressionMode,
  ThemePreference,
  DensityPreference,
  UserSettings,
  MediaProfile,
  BroadcastMode,
  BroadcastResolution,
  BroadcastCodec,
  BroadcastTransport,
} from "@/types";

export interface ApiUserSettings {
  userId: string;
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
  keybinds: unknown;
  mediaProfile: MediaProfile;
  broadcastMode: BroadcastMode;
  broadcastResolution: BroadcastResolution;
  broadcastMaxBitrateKbps: number;
  broadcastCodec: BroadcastCodec;
  broadcastTransport: BroadcastTransport;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserSettingsInput {
  bio?: string;
  pronouns?: string;
  customStatus?: string;
  friendRequestPrivacy?: FriendRequestPrivacy;
  shareTypingStatus?: boolean;
  desktopNotifications?: boolean;
  notificationSound?: boolean;
  theme?: ThemePreference;
  density?: DensityPreference;
  micGain?: number;
  outputGain?: number;
  noiseSuppressionMode?: NoiseSuppressionMode;
  noiseGate?: number;
  pushToTalkEnabled?: boolean;
  keybinds?: Partial<Record<KeybindAction, Keybind | null>>;
  mediaProfile?: MediaProfile;
  broadcastMode?: BroadcastMode;
  broadcastResolution?: BroadcastResolution;
  broadcastMaxBitrateKbps?: number;
  broadcastCodec?: BroadcastCodec;
  broadcastTransport?: BroadcastTransport;
}

function parseKeybinds(
  raw: unknown,
): Partial<Record<KeybindAction, Keybind | null>> {
  const parsed =
    raw && typeof raw === "object"
      ? (raw as Partial<Record<KeybindAction, Keybind | null>>)
      : {};
  return { ...DEFAULT_KEYBINDS, ...parsed };
}

export function toUserSettings(api: ApiUserSettings): UserSettings {
  return {
    bio: api.bio,
    pronouns: api.pronouns,
    customStatus: api.customStatus,
    friendRequestPrivacy: api.friendRequestPrivacy,
    shareTypingStatus: api.shareTypingStatus,
    desktopNotifications: api.desktopNotifications,
    notificationSound: api.notificationSound,
    theme:
      api.theme === "light" || api.theme === "system" ? api.theme : "dark",
    density:
      api.density === "compact" || api.density === "comfortable"
        ? api.density
        : "normal",
    micGain: api.micGain ?? 100,
    outputGain: api.outputGain ?? 100,
    noiseSuppressionMode:
      api.noiseSuppressionMode === "manual" ? "manual" : "auto",
    noiseGate: api.noiseGate ?? 40,
    pushToTalkEnabled: Boolean(api.pushToTalkEnabled),
    keybinds: parseKeybinds(api.keybinds),
    mediaProfile: api.mediaProfile === "gaming" ? "gaming" : "quality",
    broadcastMode: api.broadcastMode === "manual" ? "manual" : "auto",
    broadcastResolution: ["480p", "720p", "1080p", "native"].includes(
      api.broadcastResolution,
    )
      ? api.broadcastResolution
      : "720p",
    broadcastMaxBitrateKbps: api.broadcastMaxBitrateKbps ?? 2000,
    broadcastCodec: ["auto", "vp8", "vp9", "h264"].includes(api.broadcastCodec)
      ? api.broadcastCodec
      : "auto",
    broadcastTransport: ["auto", "p2p", "sfu"].includes(api.broadcastTransport)
      ? api.broadcastTransport
      : "auto",
  };
}

export function getUserSettings() {
  return apiFetch<ApiUserSettings>("/users/me/settings");
}

export function updateUserSettings(input: UpdateUserSettingsInput) {
  return apiFetch<ApiUserSettings>("/users/me/settings", {
    method: "PATCH",
    body: input,
  });
}
