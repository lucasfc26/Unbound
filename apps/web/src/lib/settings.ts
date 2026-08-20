import { apiFetch } from "./api";
import { DEFAULT_KEYBINDS } from "./keybinds";
import type {
  FriendRequestPrivacy,
  Keybind,
  KeybindAction,
  NoiseSuppressionMode,
  UserSettings,
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
  micGain: number;
  outputGain: number;
  noiseSuppressionMode: NoiseSuppressionMode;
  noiseGate: number;
  pushToTalkEnabled: boolean;
  keybinds: unknown;
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
  micGain?: number;
  outputGain?: number;
  noiseSuppressionMode?: NoiseSuppressionMode;
  noiseGate?: number;
  pushToTalkEnabled?: boolean;
  keybinds?: Partial<Record<KeybindAction, Keybind | null>>;
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
    micGain: api.micGain ?? 100,
    outputGain: api.outputGain ?? 100,
    noiseSuppressionMode:
      api.noiseSuppressionMode === "manual" ? "manual" : "auto",
    noiseGate: api.noiseGate ?? 40,
    pushToTalkEnabled: Boolean(api.pushToTalkEnabled),
    keybinds: parseKeybinds(api.keybinds),
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
