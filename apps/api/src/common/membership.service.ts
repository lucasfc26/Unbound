import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ServerMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Permission, hasPermission } from './permissions';

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async getMembership(serverId: string, userId: string): Promise<ServerMember> {
    const member = await this.prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member)
      throw new ForbiddenException('Você não é membro deste servidor');
    return member;
  }

  async assertPermission(
    serverId: string,
    userId: string,
    permission: Permission,
  ): Promise<ServerMember> {
    const member = await this.getMembership(serverId, userId);
    if (!hasPermission(member.role, permission)) {
      throw new ForbiddenException('Você não tem permissão para essa ação');
    }
    return member;
  }
}
