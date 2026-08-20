import { apiFetch, apiUpload } from "./api";
import type { User, UserStatus } from "@/types";

export interface ApiPrivateUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: string;
  friendCode: string;
  bio: string | null;
  pronouns: string | null;
  customStatus: string | null;
}

export function toUser(api: ApiPrivateUser, avatarColor: string): User {
  return { ...api, avatarColor };
}

export function updateProfile(input: {
  displayName?: string;
  avatarUrl?: string;
}) {
  return apiFetch<ApiPrivateUser>("/users/me", {
    method: "PATCH",
    body: input,
  });
}

export function uploadAvatar(file: File) {
  return apiUpload<ApiPrivateUser>("/users/me/avatar", file);
}

export function updateAccount(input: {
  username?: string;
  email?: string;
  currentPassword: string;
}) {
  return apiFetch<ApiPrivateUser>("/users/me/account", {
    method: "PATCH",
    body: input,
  });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return apiFetch<void>("/users/me/change-password", {
    method: "POST",
    body: input,
  });
}

export function deleteAccount(password: string) {
  return apiFetch<void>("/users/me", {
    method: "DELETE",
    body: { password },
  });
}

export function regenerateFriendCode() {
  return apiFetch<ApiPrivateUser>("/users/me/friend-code/regenerate", {
    method: "POST",
  });
}
