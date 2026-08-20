import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, REFRESH_TOKEN_TTL_SECONDS } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, type RequestUser } from './current-user.decorator';

const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.auth.register(dto);
    this.setRefreshCookie(res, refreshToken);
    // Desktop stores this itself (see useAuthStore + lib/desktopSession) as
    // a fallback session restore path independent of the WebView2 cookie
    // jar — not a new exposure, this same value already went out on the
    // same response via Set-Cookie above.
    return { user, accessToken, refreshToken };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.auth.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken, refreshToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.auth.refresh(
      req.cookies?.[REFRESH_COOKIE] ?? dto.refreshToken,
    );
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken, refreshToken };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(user.id);
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  private refreshCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      // Desktop (http://tauri.localhost) is cross-site to the API, so Lax
      // cookies are dropped and the next launch would force a new login.
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      secure: isProd,
      path: '/',
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      ...this.refreshCookieOptions(),
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
  }
}
