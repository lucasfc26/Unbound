import { apiFetch } from "./api";
import type { ChannelType, ChannelVisibility } from "@/types";

export interface ApiChannelCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface ApiChannel {
  id: string;
  serverId: string;
  categoryId: string | null;
  name: string;
  type: ChannelType;
  visibility: ChannelVisibility;
  topic: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export function listCategories(serverId: string) {
  return apiFetch<ApiChannelCategory[]>(`/servers/${serverId}/categories`);
}

export function createCategory(serverId: string, name: string) {
  return apiFetch<ApiChannelCategory>(`/servers/${serverId}/categories`, {
    method: "POST",
    body: { name },
  });
}

export function listChannels(serverId: string) {
  return apiFetch<ApiChannel[]>(`/servers/${serverId}/channels`);
}

export function createChannel(
  serverId: string,
  input: {
    name: string;
    type: ChannelType;
    categoryId?: string | null;
    topic?: string;
    visibility?: ChannelVisibility;
  },
) {
  return apiFetch<ApiChannel>(`/servers/${serverId}/channels`, {
    method: "POST",
    body: input,
  });
}

export function updateChannel(
  serverId: string,
  channelId: string,
  input: {
    name?: string;
    topic?: string;
    categoryId?: string | null;
    visibility?: ChannelVisibility;
  },
) {
  return apiFetch<ApiChannel>(`/servers/${serverId}/channels/${channelId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteChannel(serverId: string, channelId: string) {
  return apiFetch<void>(`/servers/${serverId}/channels/${channelId}`, {
    method: "DELETE",
  });
}

export function reorderChannels(
  serverId: string,
  items: { id: string; categoryId?: string | null; position: number }[],
) {
  return apiFetch<void>(`/servers/${serverId}/channels/reorder`, {
    method: "PATCH",
    body: { items },
  });
}

export function updateCategory(
  serverId: string,
  categoryId: string,
  input: { name: string },
) {
  return apiFetch<ApiChannelCategory>(
    `/servers/${serverId}/categories/${categoryId}`,
    {
      method: "PATCH",
      body: input,
    },
  );
}

export function deleteCategory(serverId: string, categoryId: string) {
  return apiFetch<void>(`/servers/${serverId}/categories/${categoryId}`, {
    method: "DELETE",
  });
}
