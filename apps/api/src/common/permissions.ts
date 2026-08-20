import type { ServerRole } from '@prisma/client';

export enum Permission {
  MANAGE_SERVER = 'MANAGE_SERVER',
  MANAGE_CHANNELS = 'MANAGE_CHANNELS',
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  SEND_MESSAGES = 'SEND_MESSAGES',
  READ_MESSAGES = 'READ_MESSAGES',
  CONNECT_VOICE = 'CONNECT_VOICE',
  SPEAK = 'SPEAK',
  SHARE_SCREEN = 'SHARE_SCREEN',
  MUTE_MEMBERS = 'MUTE_MEMBERS',
  MOVE_MEMBERS = 'MOVE_MEMBERS',
}

const ALL_PERMISSIONS = Object.values(Permission);

const BASE_MEMBER_PERMISSIONS = [
  Permission.SEND_MESSAGES,
  Permission.READ_MESSAGES,
  Permission.CONNECT_VOICE,
  Permission.SPEAK,
  Permission.SHARE_SCREEN,
];

export const ROLE_PERMISSIONS: Record<ServerRole, Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS,
  // Same staff tools as ADMIN (channels, members, invites, server settings).
  // Hierarchy checks — not this list — are what stop a moderator from
  // touching an administrator or deleting the server (delete is OWNER-only).
  MODERATOR: ALL_PERMISSIONS,
  MEMBER: BASE_MEMBER_PERMISSIONS,
};

export const ASSIGNABLE_ROLES: Exclude<ServerRole, 'OWNER'>[] = [
  'ADMIN',
  'MODERATOR',
  'MEMBER',
];

export function hasPermission(
  role: ServerRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canDeleteServer(role: ServerRole): boolean {
  return role === 'OWNER';
}

/**
 * Who a staff member may kick, ban, mute, move, or change the role of.
 * Moderators match administrators in tools, but only over members and other
 * moderators — never the owner or an administrator.
 */
export function canManageMember(
  actorRole: ServerRole,
  targetRole: ServerRole,
): boolean {
  if (targetRole === 'OWNER') return false;
  if (actorRole === 'OWNER') return true;
  if (actorRole === 'ADMIN') return targetRole !== 'ADMIN';
  if (actorRole === 'MODERATOR') {
    return targetRole === 'MODERATOR' || targetRole === 'MEMBER';
  }
  return false;
}

export function canAssignRole(
  actorRole: ServerRole,
  newRole: ServerRole,
): boolean {
  if (newRole === 'OWNER') return false;
  if (actorRole === 'OWNER' || actorRole === 'ADMIN') {
    return (
      newRole === 'ADMIN' || newRole === 'MODERATOR' || newRole === 'MEMBER'
    );
  }
  if (actorRole === 'MODERATOR') {
    return newRole === 'MODERATOR' || newRole === 'MEMBER';
  }
  return false;
}
