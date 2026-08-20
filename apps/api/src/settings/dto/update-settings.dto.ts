import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FriendRequestPrivacy } from '@prisma/client';

export class UpdateSettingsDto {
  // Perfil
  @IsOptional()
  @IsString()
  @MaxLength(190)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  pronouns?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customStatus?: string;

  // Privacidade
  @IsOptional()
  @IsEnum(FriendRequestPrivacy)
  friendRequestPrivacy?: FriendRequestPrivacy;

  @IsOptional()
  @IsBoolean()
  shareTypingStatus?: boolean;

  // Notificações
  @IsOptional()
  @IsBoolean()
  desktopNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationSound?: boolean;

  // Voz
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(300)
  micGain?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(300)
  outputGain?: number;

  @IsOptional()
  @IsIn(['auto', 'manual'])
  noiseSuppressionMode?: 'auto' | 'manual';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  noiseGate?: number;

  @IsOptional()
  @IsBoolean()
  pushToTalkEnabled?: boolean;

  @IsOptional()
  @IsObject()
  keybinds?: Record<string, unknown>;
}
