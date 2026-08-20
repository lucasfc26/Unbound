import { apiFetch } from "./api";

export interface ApiInvite {
  id: string;
  code: string;
  serverId: string;
  creatorId: string;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
}

export interface ApiInvitePreview {
  server: {
    id: string;
    name: string;
    description: string | null;
    iconColor: string;
    iconUrl: string | null;
  };
  memberCount: number;
  expiresAt: string | null;
}

export function createInvite(
  serverId: string,
  input: { maxUses?: number; expiresInDays?: number } = {},
) {
  return apiFetch<ApiInvite>(`/servers/${serverId}/invites`, {
    method: "POST",
    body: input,
  });
}

export function previewInvite(code: string) {
  return apiFetch<ApiInvitePreview>(`/invites/${code}`);
}

export function joinByInvite(code: string) {
  return apiFetch<{ id: string }>(`/invites/${code}/join`, { method: "POST" });
}
