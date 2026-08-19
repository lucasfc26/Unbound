import { apiFetch } from "./api";
import type { FriendRequestPrivacy, UserSettings } from "@/types";

export interface ApiUserSettings {
  userId: string;
  bio: string | null;
  pronouns: string | null;
  customStatus: string | null;
  friendRequestPrivacy: FriendRequestPrivacy;
  shareTypingStatus: boolean;
  desktopNotifications: boolean;
  notificationSound: boolean;
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
