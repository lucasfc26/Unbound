import type { UserStatus } from "@/types";

export const statusLabels: Record<UserStatus, string> = {
  ONLINE: "Online",
  IDLE: "Ausente",
  DO_NOT_DISTURB: "Não perturbe",
  INVISIBLE: "Invisível",
  OFFLINE: "Offline",
};
