import { Injectable } from '@nestjs/common';
import type { UserSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withUserContext } from '../prisma/rls';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

const DEFAULTS = {
  bio: null,
  pronouns: null,
  customStatus: null,
  friendRequestPrivacy: 'EVERYONE' as const,
  shareTypingStatus: true,
  desktopNotifications: true,
  notificationSound: true,
};

/** Turns an empty string into `null` (the "clear this field" gesture); leaves absent fields absent. */
function normalize(
  dto: UpdateSettingsDto,
): Partial<Pick<UserSettings, 'bio' | 'pronouns' | 'customStatus'>> &
  Omit<UpdateSettingsDto, 'bio' | 'pronouns' | 'customStatus'> {
  const { bio, pronouns, customStatus, ...rest } = dto;
  return {
    ...rest,
    ...(bio !== undefined && { bio: bio === '' ? null : bio }),
    ...(pronouns !== undefined && {
      pronouns: pronouns === '' ? null : pronouns,
    }),
    ...(customStatus !== undefined && {
      customStatus: customStatus === '' ? null : customStatus,
    }),
  };
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserSettings> {
    const existing = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    return withUserContext(this.prisma, userId, (tx) =>
      tx.userSettings.upsert({
        where: { userId },
        create: { userId, ...DEFAULTS },
        update: {},
      }),
    );
  }

  async update(userId: string, dto: UpdateSettingsDto): Promise<UserSettings> {
    const data = normalize(dto);
    return withUserContext(this.prisma, userId, (tx) =>
      tx.userSettings.upsert({
        where: { userId },
        create: { userId, ...DEFAULTS, ...data },
        update: data,
      }),
    );
  }
}
