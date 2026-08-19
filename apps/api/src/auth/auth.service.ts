import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { toPrivateUser, type PrivateUser } from '../users/user.presenter';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { UpdateAccountDto } from '../users/dto/update-account.dto';
import type { ChangePasswordDto } from '../users/dto/change-password.dto';
import type { DeleteAccountDto } from '../users/dto/delete-account.dto';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AuthResult {
  user: PrivateUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async register(input: RegisterDto): Promise<AuthResult> {
    const taken = await this.users.isEmailOrUsernameTaken(
      input.email,
      input.username,
    );
    if (taken) {
      throw new ConflictException('Usuário ou e-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.users.create({
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      passwordHash,
    });
    await this.users.setStatus(user.id, 'ONLINE');

    return this.issueSession(user.id);
  }

  async login(input: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByIdentifier(input.identifier);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.users.setStatus(user.id, 'ONLINE');
    return this.issueSession(user.id);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Sessão não encontrada');
    }

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Sessão expirada');
    }

    const stored = await this.redis.get(this.refreshKey(payload.sub));
    if (!stored || stored !== refreshToken) {
      throw new UnauthorizedException('Sessão inválida');
    }

    return this.issueSession(payload.sub);
  }

  async logout(userId: string): Promise<void> {
    await this.redis.del(this.refreshKey(userId));
    await this.users.setStatus(userId, 'OFFLINE');
  }

  async me(userId: string): Promise<PrivateUser> {
    const user = await this.users.findByIdWithSettings(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return toPrivateUser(user, user.settings);
  }

  async updateAccount(
    userId: string,
    dto: UpdateAccountDto,
  ): Promise<PrivateUser> {
    await this.verifyPassword(userId, dto.currentPassword);
    const user = await this.users.updateAccount(userId, {
      username: dto.username,
      email: dto.email,
    });
    const withSettings = await this.users.findByIdWithSettings(user.id);
    return toPrivateUser(user, withSettings?.settings ?? null);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    await this.verifyPassword(userId, dto.currentPassword);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.users.setPasswordHash(userId, passwordHash);
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    await this.verifyPassword(userId, dto.password);
    await this.users.deleteAccount(userId);
    await this.redis.del(this.refreshKey(userId));
  }

  private async verifyPassword(
    userId: string,
    password: string,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Senha incorreta');
  }

  private async issueSession(userId: string): Promise<AuthResult> {
    const user = await this.users.findByIdWithSettings(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, username: user.username },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );

    await this.redis.set(
      this.refreshKey(user.id),
      refreshToken,
      'EX',
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return {
      user: toPrivateUser(user, user.settings),
      accessToken,
      refreshToken,
    };
  }

  private refreshKey(userId: string): string {
    return `refresh:${userId}`;
  }
}
