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
  MODERATOR: [
    Permission.MANAGE_CHANNELS,
    Permission.MANAGE_MEMBERS,
    Permission.MUTE_MEMBERS,
    Permission.MOVE_MEMBERS,
    ...BASE_MEMBER_PERMISSIONS,
  ],
  MEMBER: BASE_MEMBER_PERMISSIONS,
};

export function hasPermission(
  role: ServerRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
