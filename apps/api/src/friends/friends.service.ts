import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  toPublicUser,
  maskInvisible,
  type PublicUser,
} from '../users/user.presenter';
import type { SendFriendRequestDto } from './dto/send-friend-request.dto';

export interface FriendRequestEntry {
  id: string;
  user: PublicUser;
  createdAt: Date;
}

export interface FriendEntry {
  friendshipId: string;
  user: PublicUser;
  since: Date;
}

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async sendRequest(userId: string, dto: SendFriendRequestDto) {
    const target = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!target) throw new NotFoundException('Usuário não encontrado');
    if (target.id === userId)
      throw new BadRequestException('Você não pode adicionar a si mesmo');

    const existing = await this.findBetween(userId, target.id);
    if (existing) {
      if (existing.status === 'BLOCKED') {
        throw new ForbiddenException(
          'Não é possível enviar uma solicitação para este usuário',
        );
      }
      if (existing.status === 'ACCEPTED') {
        throw new ConflictException('Vocês já são amigos');
      }
      throw new ConflictException(
        'Já existe uma solicitação pendente com este usuário',
      );
    }

    return this.prisma.friendship.create({
      data: { requesterId: userId, addresseeId: target.id, status: 'PENDING' },
    });
  }

  async listRequests(userId: string): Promise<{
    incoming: FriendRequestEntry[];
    outgoing: FriendRequestEntry[];
  }> {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { addresseeId: userId, status: 'PENDING' },
        include: { requester: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.friendship.findMany({
        where: { requesterId: userId, status: 'PENDING' },
        include: { addressee: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      incoming: incoming.map((f) => ({
        id: f.id,
        user: maskInvisible(toPublicUser(f.requester)),
        createdAt: f.createdAt,
      })),
      outgoing: outgoing.map((f) => ({
        id: f.id,
        user: maskInvisible(toPublicUser(f.addressee)),
        createdAt: f.createdAt,
      })),
    };
  }

  async accept(userId: string, requestId: string) {
    await this.getPendingIncoming(userId, requestId);
    return this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' },
    });
  }

  async reject(userId: string, requestId: string): Promise<void> {
    await this.getPendingIncoming(userId, requestId);
    await this.prisma.friendship.delete({ where: { id: requestId } });
  }

  async cancel(userId: string, requestId: string): Promise<void> {
    const request = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (
      !request ||
      request.requesterId !== userId ||
      request.status !== 'PENDING'
    ) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    await this.prisma.friendship.delete({ where: { id: requestId } });
  }

  async listFriends(userId: string): Promise<FriendEntry[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: { requester: true, addressee: true },
      orderBy: { updatedAt: 'desc' },
    });

    return friendships.map((f) => {
      const friend = f.requesterId === userId ? f.addressee : f.requester;
      return {
        friendshipId: f.id,
        user: maskInvisible(toPublicUser(friend)),
        since: f.updatedAt,
      };
    });
  }

  async remove(userId: string, targetUserId: string): Promise<void> {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: targetUserId },
          { requesterId: targetUserId, addresseeId: userId },
        ],
      },
    });
    if (!friendship) throw new NotFoundException('Amizade não encontrada');
    await this.prisma.friendship.delete({ where: { id: friendship.id } });
  }

  private findBetween(userId: string, otherId: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: userId },
        ],
      },
    });
  }

  private async getPendingIncoming(userId: string, requestId: string) {
    const request = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (
      !request ||
      request.addresseeId !== userId ||
      request.status !== 'PENDING'
    ) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    return request;
  }
}
