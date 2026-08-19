import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type {
  Server,
  ServerBan,
  ServerMember,
  ServerRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import {
  toPublicUser,
  maskInvisible,
  type PublicUser,
} from '../users/user.presenter';
import { Permission } from '../common/permissions';
import type { CreateServerDto } from './dto/create-server.dto';
import type { UpdateServerDto } from './dto/update-server.dto';

export interface MemberWithUser extends ServerMember {
  user: PublicUser;
}

export interface BanWithUser extends ServerBan {
  user: PublicUser;
  bannedBy: PublicUser;
}

@Injectable()
export class ServersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async create(userId: string, dto: CreateServerDto): Promise<Server> {
    return this.prisma.$transaction(async (tx) => {
      const server = await tx.server.create({
        data: {
          name: dto.name,
          description: dto.description,
          iconColor: dto.iconColor,
          ownerId: userId,
        },
      });
      await tx.serverMember.create({
        data: { serverId: server.id, userId, role: 'OWNER' },
      });
      return server;
    });
  }

  findAllForUser(userId: string): Promise<Server[]> {
    return this.prisma.server.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOneForUser(serverId: string, userId: string): Promise<Server> {
    await this.membership.getMembership(serverId, userId);
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });
    if (!server) throw new NotFoundException('Servidor não encontrado');
    return server;
  }

  async update(
    serverId: string,
    userId: string,
    dto: UpdateServerDto,
  ): Promise<Server> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_SERVER,
    );
    return this.prisma.server.update({ where: { id: serverId }, data: dto });
  }

  async join(serverId: string, userId: string): Promise<ServerMember> {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });
    if (!server) throw new NotFoundException('Servidor não encontrado');

    const ban = await this.prisma.serverBan.findUnique({
      where: { serverId_userId: { serverId, userId } },
    });
    if (ban) throw new ForbiddenException('Você foi banido deste servidor');

    const existing = await this.prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (existing) return existing;

    return this.prisma.serverMember.create({
      data: { serverId, userId, role: 'MEMBER' },
    });
  }

  async leave(serverId: string, userId: string): Promise<void> {
    const member = await this.membership.getMembership(serverId, userId);
    if (member.role === 'OWNER') {
      throw new BadRequestException(
        'O dono não pode sair do servidor. Exclua o servidor para encerrá-lo.',
      );
    }
    await this.prisma.serverMember.delete({ where: { id: member.id } });
  }

  async remove(
    serverId: string,
    userId: string,
    password: string,
  ): Promise<void> {
    const member = await this.membership.getMembership(serverId, userId);
    if (member.role !== 'OWNER') {
      throw new ForbiddenException('Apenas o dono pode excluir o servidor');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Senha incorreta');
    }

    await this.prisma.server.delete({ where: { id: serverId } });
  }

  async listMembers(
    serverId: string,
    userId: string,
  ): Promise<MemberWithUser[]> {
    await this.membership.getMembership(serverId, userId);
    const members = await this.prisma.serverMember.findMany({
      where: { serverId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((member) => ({
      ...member,
      user:
        member.userId === userId
          ? toPublicUser(member.user)
          : maskInvisible(toPublicUser(member.user)),
    }));
  }

  async updateMemberRole(
    serverId: string,
    actingUserId: string,
    targetUserId: string,
    role: ServerRole,
  ): Promise<ServerMember> {
    await this.membership.assertPermission(
      serverId,
      actingUserId,
      Permission.MANAGE_MEMBERS,
    );
    const target = await this.prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: targetUserId, serverId } },
    });
    if (!target) throw new NotFoundException('Membro não encontrado');
    if (target.role === 'OWNER')
      throw new ForbiddenException('Não é possível alterar o dono');

    return this.prisma.serverMember.update({
      where: { id: target.id },
      data: { role },
    });
  }

  async kickMember(
    serverId: string,
    actingUserId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.membership.assertPermission(
      serverId,
      actingUserId,
      Permission.MANAGE_MEMBERS,
    );
    if (targetUserId === actingUserId) {
      throw new BadRequestException('Use a opção "Sair" para se remover');
    }
    const target = await this.prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: targetUserId, serverId } },
    });
    if (!target) throw new NotFoundException('Membro não encontrado');
    if (target.role === 'OWNER')
      throw new ForbiddenException('Não é possível remover o dono');

    await this.prisma.serverMember.delete({ where: { id: target.id } });
  }

  async banMember(
    serverId: string,
    actingUserId: string,
    targetUserId: string,
    reason: string | undefined,
  ): Promise<ServerBan> {
    await this.membership.assertPermission(
      serverId,
      actingUserId,
      Permission.MANAGE_MEMBERS,
    );
    if (targetUserId === actingUserId) {
      throw new BadRequestException('Você não pode banir a si mesmo');
    }

    const target = await this.prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: targetUserId, serverId } },
    });
    if (target?.role === 'OWNER')
      throw new ForbiddenException('Não é possível banir o dono');

    return this.prisma.$transaction(async (tx) => {
      if (target) {
        await tx.serverMember.delete({ where: { id: target.id } });
      }
      return tx.serverBan.upsert({
        where: { serverId_userId: { serverId, userId: targetUserId } },
        create: {
          serverId,
          userId: targetUserId,
          reason,
          bannedById: actingUserId,
        },
        update: { reason, bannedById: actingUserId },
      });
    });
  }

  async unbanMember(
    serverId: string,
    actingUserId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.membership.assertPermission(
      serverId,
      actingUserId,
      Permission.MANAGE_MEMBERS,
    );
    await this.prisma.serverBan.delete({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });
  }

  async listBans(serverId: string, userId: string): Promise<BanWithUser[]> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_MEMBERS,
    );
    const bans = await this.prisma.serverBan.findMany({
      where: { serverId },
      include: { user: true, bannedBy: true },
      orderBy: { createdAt: 'desc' },
    });
    return bans.map((ban) => ({
      ...ban,
      user: toPublicUser(ban.user),
      bannedBy: toPublicUser(ban.bannedBy),
    }));
  }
}
