import { randomBytes } from 'node:crypto';
import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Invitation, Server } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { Permission } from '../common/permissions';
import type { CreateInviteDto } from './dto/create-invite.dto';

function generateCode(): string {
  return randomBytes(5).toString('hex').toUpperCase();
}

const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async create(
    serverId: string,
    userId: string,
    dto: CreateInviteDto,
  ): Promise<Invitation> {
    await this.membership.getMembership(serverId, userId);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.invitation.create({
          data: {
            code: generateCode(),
            serverId,
            creatorId: userId,
            maxUses: dto.maxUses,
            expiresAt: dto.expiresInDays
              ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
              : undefined,
          },
        });
      } catch (error) {
        const isUniqueViolation = (error as { code?: string }).code === 'P2002';
        if (!isUniqueViolation || attempt === MAX_CODE_ATTEMPTS - 1)
          throw error;
      }
    }
    throw new Error('unreachable');
  }

  async listForServer(serverId: string, userId: string): Promise<Invitation[]> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_SERVER,
    );
    return this.prisma.invitation.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(
    serverId: string,
    userId: string,
    inviteId: string,
  ): Promise<void> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_SERVER,
    );
    const invite = await this.prisma.invitation.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.serverId !== serverId)
      throw new NotFoundException('Convite não encontrado');
    await this.prisma.invitation.delete({ where: { id: inviteId } });
  }

  async preview(
    code: string,
  ): Promise<{ server: Server; memberCount: number; expiresAt: Date | null }> {
    const invite = await this.findValidInvite(code);
    const [server, memberCount] = await Promise.all([
      this.prisma.server.findUniqueOrThrow({ where: { id: invite.serverId } }),
      this.prisma.serverMember.count({ where: { serverId: invite.serverId } }),
    ]);
    return { server, memberCount, expiresAt: invite.expiresAt };
  }

  async join(code: string, userId: string): Promise<Server> {
    const invite = await this.findValidInvite(code);

    const ban = await this.prisma.serverBan.findUnique({
      where: { serverId_userId: { serverId: invite.serverId, userId } },
    });
    if (ban) throw new ForbiddenException('Você foi banido deste servidor');

    const existing = await this.prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId: invite.serverId } },
    });

    if (!existing) {
      await this.prisma.$transaction([
        this.prisma.serverMember.create({
          data: { serverId: invite.serverId, userId, role: 'MEMBER' },
        }),
        this.prisma.invitation.update({
          where: { id: invite.id },
          data: { uses: { increment: 1 } },
        }),
      ]);
    }

    return this.prisma.server.findUniqueOrThrow({
      where: { id: invite.serverId },
    });
  }

  private async findValidInvite(code: string): Promise<Invitation> {
    const invite = await this.prisma.invitation.findUnique({ where: { code } });
    if (!invite) throw new NotFoundException('Convite inválido');
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Este convite expirou');
    }
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      throw new GoneException('Este convite atingiu o limite de usos');
    }
    return invite;
  }
}
