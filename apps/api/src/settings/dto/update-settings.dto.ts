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

  // Aparência
  @IsOptional()
  @IsIn(['dark', 'light', 'custom'])
  theme?: 'dark' | 'light' | 'custom';

  @IsOptional()
  @IsObject()
  customColors?: Record<string, string>;

  @IsOptional()
  @IsIn(['compact', 'normal', 'comfortable'])
  density?: 'compact' | 'normal' | 'comfortable';

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

  // Transmissão
  @IsOptional()
  @IsIn(['quality', 'gaming'])
  mediaProfile?: 'quality' | 'gaming';

  @IsOptional()
  @IsIn(['auto', 'manual'])
  broadcastMode?: 'auto' | 'manual';

  @IsOptional()
  @IsIn(['480p', '720p', '1080p', 'native'])
  broadcastResolution?: '480p' | '720p' | '1080p' | 'native';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(300)
  @Max(8000)
  broadcastMaxBitrateKbps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(60)
  broadcastFps?: number;

  @IsOptional()
  @IsIn(['auto', 'vp8', 'vp9', 'h264'])
  broadcastCodec?: 'auto' | 'vp8' | 'vp9' | 'h264';

  @IsOptional()
  @IsIn(['auto', 'p2p', 'sfu'])
  broadcastTransport?: 'auto' | 'p2p' | 'sfu';
}
