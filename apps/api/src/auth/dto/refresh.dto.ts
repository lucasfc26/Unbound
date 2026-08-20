import { IsOptional, IsString } from 'class-validator';

/**
 * The desktop app's fallback session store (see useAuthStore's bootstrap)
 * sends its saved refresh token here explicitly when it has one — the
 * WebView2 cookie jar is the primary path, this just covers it not
 * surviving a restart.
 */
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
