import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User, UserStatus } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { withUserContext } from '../prisma/rls';
import { generateFriendCode } from './friend-code';

export interface CreateUserInput {
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  avatarUrl?: string | null;
}

export interface UpdateAccountInput {
  email?: string;
  username?: string;
}

const FRIEND_CODE_ATTEMPTS = 5;

function isFriendCodeCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray((error.meta as { target?: unknown })?.target) &&
    (error.meta as { target: string[] }).target.includes('friendCode')
  );
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByIdWithSettings(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { settings: true },
    });
  }

  findByIdentifier(identifier: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });
  }

  findByFriendCode(code: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { friendCode: code } });
  }

  async isEmailOrUsernameTaken(
    email: string,
    username: string,
  ): Promise<boolean> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async create(input: CreateUserInput): Promise<User> {
    for (let attempt = 0; attempt < FRIEND_CODE_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.user.create({
          data: { ...input, friendCode: generateFriendCode() },
        });
      } catch (error) {
        if (isFriendCodeCollision(error) && attempt < FRIEND_CODE_ATTEMPTS - 1)
          continue;
        throw error;
      }
    }
    throw new Error('Não foi possível gerar um código de amigo único');
  }

  async setStatus(id: string, status: UserStatus): Promise<User | null> {
    try {
      return await this.prisma.user.update({ where: { id }, data: { status } });
    } catch (error) {
      // The account may have just been deleted (e.g. right after deleteAccount()) while a
      // logout call or a socket disconnect for that same user is still in flight — nothing
      // to update at that point, and letting P2025 escape here would crash whatever caller
      // triggered it (a WS lifecycle hook isn't wrapped by Nest's HTTP exception filter).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  setPasswordHash(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: input });
  }

  async saveAvatar(
    userId: string,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<User> {
    const allowed = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException('Use uma imagem JPG, PNG, WEBP ou GIF');
    }
    const dir = join(process.cwd(), 'uploads', 'avatars');
    mkdirSync(dir, { recursive: true });
    const filename = `${userId}.jpg`;
    writeFileSync(join(dir, filename), file.buffer);
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: `/uploads/avatars/${filename}` },
    });
  }

  async updateAccount(
    userId: string,
    input: UpdateAccountInput,
  ): Promise<User> {
    if (input.email || input.username) {
      const existing = await this.prisma.user.findFirst({
        where: {
          OR: [
            ...(input.email ? [{ email: input.email }] : []),
            ...(input.username ? [{ username: input.username }] : []),
          ],
          NOT: { id: userId },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Usuário ou e-mail já cadastrado');
      }
    }
    return this.prisma.user.update({ where: { id: userId }, data: input });
  }

  async regenerateFriendCode(userId: string): Promise<User> {
    for (let attempt = 0; attempt < FRIEND_CODE_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.user.update({
          where: { id: userId },
          data: { friendCode: generateFriendCode() },
        });
      } catch (error) {
        if (isFriendCodeCollision(error) && attempt < FRIEND_CODE_ATTEMPTS - 1)
          continue;
        throw error;
      }
    }
    throw new Error('Não foi possível gerar um código de amigo único');
  }

  async deleteAccount(userId: string): Promise<void> {
    const ownedServersCount = await this.prisma.server.count({
      where: { ownerId: userId },
    });
    if (ownedServersCount > 0) {
      throw new ConflictException(
        'Transfira a propriedade ou exclua os servidores que você possui antes de excluir sua conta',
      );
    }
    await withUserContext(this.prisma, userId, (tx) =>
      tx.user.delete({ where: { id: userId } }),
    );
  }
}
