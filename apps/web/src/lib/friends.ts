import { apiFetch } from "./api";
import type { UserStatus } from "@/types";

export interface ApiPublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: string;
}

export interface ApiFriendRequest {
  id: string;
  user: ApiPublicUser;
  createdAt: string;
}

export interface ApiFriend {
  friendshipId: string;
  user: ApiPublicUser;
  since: string;
}

export function listFriends() {
  return apiFetch<ApiFriend[]>("/friends");
}

export function listFriendRequests() {
  return apiFetch<{
    incoming: ApiFriendRequest[];
    outgoing: ApiFriendRequest[];
  }>("/friends/requests");
}

export function sendFriendRequest(username: string) {
  return apiFetch<unknown>("/friends/requests", {
    method: "POST",
    body: { username },
  });
}

export function acceptFriendRequest(requestId: string) {
  return apiFetch<unknown>(`/friends/requests/${requestId}/accept`, {
    method: "POST",
  });
}

export function rejectFriendRequest(requestId: string) {
  return apiFetch<void>(`/friends/requests/${requestId}/reject`, {
    method: "POST",
  });
}

export function cancelFriendRequest(requestId: string) {
  return apiFetch<void>(`/friends/requests/${requestId}`, { method: "DELETE" });
}

export function removeFriend(userId: string) {
  return apiFetch<void>(`/friends/${userId}`, { method: "DELETE" });
}
