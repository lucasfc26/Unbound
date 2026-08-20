import { apiFetch } from "./api";
import type { ApiPublicUser } from "./friends";

export interface ApiDmConversation {
  channelId: string;
  unreadCount: number;
  lastMessageAt: string | null;
  user: ApiPublicUser;
}

export function listDms() {
  return apiFetch<ApiDmConversation[]>("/dms");
}

export function openDm(userId: string) {
  return apiFetch<ApiDmConversation>("/dms", {
    method: "POST",
    body: { userId },
  });
}

export function markDmRead(channelId: string) {
  return apiFetch<void>(`/dms/${channelId}/read`, { method: "POST" });
}
