import type { ChannelVisibility, ServerRole } from "@/types";

export function canOpenServerSettings(role?: ServerRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
}

export function canDeleteServer(role?: ServerRole): boolean {
  return role === "OWNER";
}

export function canManageMember(
  actorRole?: ServerRole,
  targetRole?: ServerRole,
): boolean {
  if (!actorRole || !targetRole) return false;
  if (targetRole === "OWNER") return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole !== "ADMIN";
  if (actorRole === "MODERATOR") {
    return targetRole === "MODERATOR" || targetRole === "MEMBER";
  }
  return false;
}

export function assignableRoles(actorRole?: ServerRole): ServerRole[] {
  if (actorRole === "OWNER" || actorRole === "ADMIN") {
    return ["ADMIN", "MODERATOR", "MEMBER"];
  }
  if (actorRole === "MODERATOR") {
    return ["MODERATOR", "MEMBER"];
  }
  return [];
}

export const ROLE_LABELS: Record<ServerRole, string> = {
  OWNER: "Dono",
  ADMIN: "Administrador",
  MODERATOR: "Moderador",
  MEMBER: "Membro",
};

export const CHANNEL_VISIBILITY_LABELS: Record<ChannelVisibility, string> = {
  EVERYONE: "Todos os membros",
  MODERATORS: "Moderadores e administradores",
  ADMINS: "Somente administradores",
};

export function canSeeChannel(
  role?: ServerRole,
  visibility: ChannelVisibility = "EVERYONE",
): boolean {
  if (visibility === "EVERYONE") return true;
  if (visibility === "MODERATORS") {
    return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
  }
  return role === "OWNER" || role === "ADMIN";
}
