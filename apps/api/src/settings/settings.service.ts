import { Injectable } from '@nestjs/common';
import { Prisma, type UserSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withUserContext } from '../prisma/rls';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

const DEFAULTS = {
  bio: null as string | null,
  pronouns: null as string | null,
  customStatus: null as string | null,
  friendRequestPrivacy: 'EVERYONE' as const,
  shareTypingStatus: true,
  desktopNotifications: true,
  notificationSound: true,
  micGain: 100,
  outputGain: 100,
  noiseSuppressionMode: 'auto',
  noiseGate: 40,
  pushToTalkEnabled: false,
};

function normalize(
  dto: UpdateSettingsDto,
): Prisma.UserSettingsUncheckedUpdateInput {
  const { bio, pronouns, customStatus, keybinds, ...rest } = dto;
  return {
    ...rest,
    ...(bio !== undefined && { bio: bio === '' ? null : bio }),
    ...(pronouns !== undefined && {
      pronouns: pronouns === '' ? null : pronouns,
    }),
    ...(customStatus !== undefined && {
      customStatus: customStatus === '' ? null : customStatus,
    }),
    ...(keybinds !== undefined && {
      keybinds: keybinds as Prisma.InputJsonValue,
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
        create: {
          userId,
          ...DEFAULTS,
          ...data,
        } as Prisma.UserSettingsUncheckedCreateInput,
        update: data,
      }),
    );
  }
}
