import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import type { UserStatus } from '@prisma/client';

/** Statuses a user can pick for themselves while connected. OFFLINE is derived from connection state, never set directly. */
export const SETTABLE_STATUSES: UserStatus[] = [
  'ONLINE',
  'IDLE',
  'DO_NOT_DISTURB',
  'INVISIBLE',
];

@Injectable()
export class PresenceService {
  constructor(private readonly redis: RedisService) {}

  /** Registers a socket for a user. Returns whether this is their first active connection. */
  async connect(
    userId: string,
    socketId: string,
  ): Promise<{ firstConnection: boolean }> {
    const before = await this.redis.scard(this.connsKey(userId));
    await this.redis.sadd(this.connsKey(userId), socketId);
    if (before === 0) {
      await this.redis.set(
        this.statusKey(userId),
        'ONLINE' satisfies UserStatus,
      );
    }
    return { firstConnection: before === 0 };
  }

  /** Unregisters a socket for a user. Returns whether that was their last active connection. */
  async disconnect(
    userId: string,
    socketId: string,
  ): Promise<{ lastConnection: boolean }> {
    await this.redis.srem(this.connsKey(userId), socketId);
    const remaining = await this.redis.scard(this.connsKey(userId));
    if (remaining === 0) {
      await this.redis.del(this.connsKey(userId), this.statusKey(userId));
    }
    return { lastConnection: remaining === 0 };
  }

  async isConnected(userId: string): Promise<boolean> {
    const count = await this.redis.scard(this.connsKey(userId));
    return count > 0;
  }

  async setStatus(userId: string, status: UserStatus): Promise<void> {
    if (!(await this.isConnected(userId))) return;
    await this.redis.set(this.statusKey(userId), status);
  }

  /** Maps a user's real status to what others should see (INVISIBLE hides as OFFLINE). */
  toPublicStatus(status: UserStatus): UserStatus {
    return status === 'INVISIBLE' ? 'OFFLINE' : status;
  }

  private connsKey(userId: string): string {
    return `presence:conns:${userId}`;
  }

  private statusKey(userId: string): string {
    return `presence:status:${userId}`;
  }
}
