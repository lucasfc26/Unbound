import type { User, UserSettings } from '@prisma/client';

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

/** A PublicUser plus the Perfil fields other users are allowed to see (e.g. in a friends list). */
export interface PublicUserWithProfile extends PublicUser {
  customStatus: string | null;
}

export function withCustomStatus(
  user: PublicUser,
  settings: Pick<UserSettings, 'customStatus'> | null,
): PublicUserWithProfile {
  return { ...user, customStatus: settings?.customStatus ?? null };
}

/** Everything shown to the authenticated user about their own account — never send this shape for another user. */
export interface PrivateUser extends PublicUser {
  friendCode: string;
  bio: string | null;
  pronouns: string | null;
  customStatus: string | null;
}

export function toPrivateUser(
  user: User,
  settings: Pick<UserSettings, 'bio' | 'pronouns' | 'customStatus'> | null,
): PrivateUser {
  return {
    ...toPublicUser(user),
    friendCode: user.friendCode,
    bio: settings?.bio ?? null,
    pronouns: settings?.pronouns ?? null,
    customStatus: settings?.customStatus ?? null,
  };
}
