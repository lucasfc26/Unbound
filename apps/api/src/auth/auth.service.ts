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
import { toPublicUser, type PublicUser } from '../users/user.presenter';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AuthResult {
  user: PublicUser;
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

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return toPublicUser(user);
  }

  private async issueSession(userId: string): Promise<AuthResult> {
    const user = await this.users.findById(userId);
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

    return { user: toPublicUser(user), accessToken, refreshToken };
  }

  private refreshKey(userId: string): string {
    return `refresh:${userId}`;
  }
}
