import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Channel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { Permission } from '../common/permissions';
import { toPublicMessage, type PublicMessage } from './message.presenter';
import { extractFirstUrl } from '../link-preview/link-preview.util';
import type { CreateMessageDto } from './dto/create-message.dto';
import type { UpdateMessageDto } from './dto/update-message.dto';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async resolveChannel(channelId: string): Promise<Channel> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');
    return channel;
  }

  async assertCanRead(channelId: string, userId: string): Promise<Channel> {
    const channel = await this.resolveChannel(channelId);
    await this.membership.assertPermission(
      channel.serverId,
      userId,
      Permission.READ_MESSAGES,
    );
    return channel;
  }

  async listMessages(
    channelId: string,
    userId: string,
    before?: string,
    limit = DEFAULT_PAGE_SIZE,
  ): Promise<PublicMessage[]> {
    await this.assertCanRead(channelId, userId);

    let beforeSequence: bigint | undefined;
    if (before) {
      const cursor = await this.prisma.message.findUnique({
        where: { id: before },
      });
      beforeSequence = cursor?.sequence;
    }

    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
        deletedAt: null,
        ...(beforeSequence ? { sequence: { lt: beforeSequence } } : {}),
      },
      include: { author: true },
      orderBy: { sequence: 'desc' },
      take: Math.min(limit, MAX_PAGE_SIZE),
    });

    return messages.reverse().map(toPublicMessage);
  }

  async createMessage(
    channelId: string,
    userId: string,
    dto: CreateMessageDto,
  ): Promise<{ message: PublicMessage; serverId: string }> {
    const channel = await this.resolveChannel(channelId);
    await this.membership.assertPermission(
      channel.serverId,
      userId,
      Permission.SEND_MESSAGES,
    );

    const message = await this.prisma.message.create({
      data: {
        channelId,
        authorId: userId,
        content: dto.content,
        replyToId: dto.replyToId,
      },
      include: { author: true },
    });

    return { message: toPublicMessage(message), serverId: channel.serverId };
  }

  async updateMessage(
    messageId: string,
    userId: string,
    dto: UpdateMessageDto,
  ): Promise<{ message: PublicMessage; channelId: string }> {
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!existing || existing.deletedAt)
      throw new NotFoundException('Mensagem não encontrada');
    if (existing.authorId !== userId) {
      throw new ForbiddenException(
        'Você só pode editar suas próprias mensagens',
      );
    }

    const stillHasUrl = Boolean(extractFirstUrl(dto.content));
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: dto.content,
        editedAt: new Date(),
        ...(stillHasUrl ? {} : { linkPreview: Prisma.DbNull }),
      },
      include: { author: true },
    });

    return { message: toPublicMessage(updated), channelId: updated.channelId };
  }

  async deleteMessage(
    messageId: string,
    userId: string,
  ): Promise<{ channelId: string; messageId: string }> {
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!existing || existing.deletedAt)
      throw new NotFoundException('Mensagem não encontrada');

    if (existing.authorId !== userId) {
      const channel = await this.resolveChannel(existing.channelId);
      await this.membership.assertPermission(
        channel.serverId,
        userId,
        Permission.MANAGE_CHANNELS,
      );
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
    return { channelId: existing.channelId, messageId };
  }
}
