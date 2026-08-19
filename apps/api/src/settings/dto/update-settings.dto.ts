import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
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
}
