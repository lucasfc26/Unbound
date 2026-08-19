import type { User } from '@prisma/client';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: User['status'];
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    status: user.status,
    createdAt: user.createdAt,
  };
}

/** Hides another user's INVISIBLE status behind OFFLINE. Never apply this to the authenticated user's own profile. */
export function maskInvisible(user: PublicUser): PublicUser {
  return user.status === 'INVISIBLE' ? { ...user, status: 'OFFLINE' } : user;
}
