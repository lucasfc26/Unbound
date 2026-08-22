import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  maskInvisible,
  toPublicUser,
  withCustomStatus,
  type PublicUserWithProfile,
} from '../users/user.presenter';

export interface PublicDmConversation {
  channelId: string;
  unreadCount: number;
  lastMessageAt: Date | null;
  user: PublicUserWithProfile;
}

@Injectable()
export class DmsService {
  constructor(private readonly prisma: PrismaService) {}

  async openWith(
    userId: string,
    otherUserId: string,
  ): Promise<PublicDmConversation> {
    if (userId === otherUserId) {
      throw new BadRequestException('Você não pode abrir um chat consigo mesmo');
    }
    await this.assertAreFriends(userId, otherUserId);
    const channel = await this.getOrCreateChannel(userId, otherUserId);
    return this.presentConversation(channel.id, userId);
  }

  async list(userId: string): Promise<PublicDmConversation[]> {
    const memberships = await this.prisma.channelMember.findMany({
      where: {
        userId,
        channel: {
          type: 'DM',
          messages: { some: { deletedAt: null } },
        },
      },
      select: { channelId: true },
    });
    const conversations = await Promise.all(
      memberships.map((row) => this.presentConversation(row.channelId, userId)),
    );
    return conversations.sort((a, b) => {
      const aTime = a.lastMessageAt?.getTime() ?? 0;
      const bTime = b.lastMessageAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  }

  async markRead(userId: string, channelId: string): Promise<void> {
    const member = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!member) throw new ForbiddenException('Você não participa deste chat');
    await this.prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  async otherMemberId(
    channelId: string,
    userId: string,
  ): Promise<string | null> {
    const other = await this.prisma.channelMember.findFirst({
      where: { channelId, userId: { not: userId } },
      select: { userId: true },
    });
    return other?.userId ?? null;
  }

  private async getOrCreateChannel(userId: string, otherUserId: string) {
    const [low, high] = [userId, otherUserId].sort();
    const dmKey = `${low}:${high}`;
    const existing = await this.prisma.channel.findUnique({
      where: { dmKey },
    });
    if (existing) return existing;

    try {
      return await this.prisma.channel.create({
        data: {
          name: 'dm',
          type: 'DM',
          dmKey,
          members: {
            create: [{ userId: low }, { userId: high }],
          },
        },
      });
    } catch (error) {
      // Two tabs opening the same DM at once can race the unique dmKey.
      const raced = await this.prisma.channel.findUnique({ where: { dmKey } });
      if (raced) return raced;
      throw error;
    }
  }

  private async presentConversation(
    channelId: string,
    userId: string,
  ): Promise<PublicDmConversation> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: { user: { include: { settings: true } } },
        },
      },
    });
    if (!channel || channel.type !== 'DM') {
      throw new NotFoundException('Conversa não encontrada');
    }

    const me = channel.members.find((member) => member.userId === userId);
    const other = channel.members.find((member) => member.userId !== userId);
    if (!me || !other) {
      throw new ForbiddenException('Você não participa deste chat');
    }

    const [unreadCount, lastMessage] = await Promise.all([
      this.prisma.message.count({
        where: {
          channelId,
          deletedAt: null,
          authorId: { not: userId },
          createdAt: { gt: me.lastReadAt },
        },
      }),
      this.prisma.message.findFirst({
        where: { channelId, deletedAt: null },
        orderBy: { sequence: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      channelId,
      unreadCount,
      lastMessageAt: lastMessage?.createdAt ?? null,
      user: withCustomStatus(
        maskInvisible(toPublicUser(other.user)),
        other.user.settings,
      ),
    };
  }

  private async assertAreFriends(userId: string, otherUserId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: userId },
        ],
      },
    });
    if (!friendship) {
      throw new ForbiddenException(
        'Vocês precisam ser amigos para conversar em particular',
      );
    }
  }
}
