import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
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
  theme: 'dark',
  density: 'normal',
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

function wrapWriteError(error: unknown): never {
  const raw = error instanceof Error ? error.message : String(error);
  if (/row-level security|P2010|42501/i.test(raw)) {
    throw new InternalServerErrorException(
      'Não foi possível salvar as configurações',
    );
  }
  if (/does not exist|P2021|P2022/i.test(raw)) {
    throw new InternalServerErrorException(
      'O banco está desatualizado. Rode as migrations e tente de novo.',
    );
  }
  throw new InternalServerErrorException(
    'Não foi possível salvar as configurações',
  );
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserSettings> {
    try {
      return await withUserContext(this.prisma, userId, async (tx) => {
        const existing = await tx.userSettings.findUnique({
          where: { userId },
        });
        if (existing) return existing;
        return tx.userSettings.create({
          data: { userId, ...DEFAULTS },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.userSettings.findUnique({
          where: { userId },
        });
        if (existing) return existing;
      }
      this.logger.error('Failed to load user settings', error);
      wrapWriteError(error);
    }
  }

  async update(userId: string, dto: UpdateSettingsDto): Promise<UserSettings> {
    const data = normalize(dto);
    try {
      return await withUserContext(this.prisma, userId, async (tx) => {
        const existing = await tx.userSettings.findUnique({
          where: { userId },
        });
        if (existing) {
          return tx.userSettings.update({ where: { userId }, data });
        }
        return tx.userSettings.create({
          data: {
            userId,
            ...DEFAULTS,
            ...data,
          } as Prisma.UserSettingsUncheckedCreateInput,
        });
      });
    } catch (error) {
      this.logger.error('Failed to update user settings', error);
      wrapWriteError(error);
    }
  }
}
