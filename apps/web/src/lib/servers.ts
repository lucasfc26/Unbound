import { apiFetch } from "./api";
import type { ServerRole, UserStatus } from "@/types";

export interface ApiServer {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  iconColor: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: string;
}

export interface ApiServerMember {
  id: string;
  userId: string;
  serverId: string;
  role: ServerRole;
  joinedAt: string;
  user: ApiPublicUser;
}

export interface ApiServerBan {
  id: string;
  serverId: string;
  userId: string;
  reason: string | null;
  bannedById: string;
  createdAt: string;
  user: ApiPublicUser;
  bannedBy: ApiPublicUser;
}

export function listServers() {
  return apiFetch<ApiServer[]>("/servers");
}

export function createServer(input: {
  name: string;
  description?: string;
  iconColor?: string;
}) {
  return apiFetch<ApiServer>("/servers", { method: "POST", body: input });
}

export function updateServer(
  serverId: string,
  input: { name?: string; description?: string; iconColor?: string },
) {
  return apiFetch<ApiServer>(`/servers/${serverId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteServer(serverId: string, password: string) {
  return apiFetch<void>(`/servers/${serverId}`, {
    method: "DELETE",
    body: { password },
  });
}

export function leaveServer(serverId: string) {
  return apiFetch<void>(`/servers/${serverId}/leave`, { method: "POST" });
}

export function listMembers(serverId: string) {
  return apiFetch<ApiServerMember[]>(`/servers/${serverId}/members`);
}

export function updateMemberRole(
  serverId: string,
  userId: string,
  role: ServerRole,
) {
  return apiFetch<ApiServerMember>(
    `/servers/${serverId}/members/${userId}/role`,
    {
      method: "PATCH",
      body: { role },
    },
  );
}

export function kickMember(serverId: string, userId: string) {
  return apiFetch<void>(`/servers/${serverId}/members/${userId}`, {
    method: "DELETE",
  });
}

export function listBans(serverId: string) {
  return apiFetch<ApiServerBan[]>(`/servers/${serverId}/bans`);
}

export function banMember(serverId: string, userId: string, reason?: string) {
  return apiFetch<ApiServerBan>(`/servers/${serverId}/bans`, {
    method: "POST",
    body: { userId, reason },
  });
}

export function unbanMember(serverId: string, userId: string) {
  return apiFetch<void>(`/servers/${serverId}/bans/${userId}`, {
    method: "DELETE",
  });
}
