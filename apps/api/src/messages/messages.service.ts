import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Channel, type ServerRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { Permission, canSeeChannel } from '../common/permissions';
import { VoiceService } from '../voice/voice.service';
import { toPublicMessage, type PublicMessage } from './message.presenter';
import { extractFirstUrl } from '../link-preview/link-preview.util';
import type { CreateMessageDto } from './dto/create-message.dto';
import type { UpdateMessageDto } from './dto/update-message.dto';

function requireServerId(channel: Channel): string {
  if (!channel.serverId) {
    throw new ForbiddenException('Você não tem permissão para essa ação');
  }
  return channel.serverId;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly voice: VoiceService,
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
    if (channel.type === 'DM') {
      await this.assertDmMember(channelId, userId);
      return channel;
    }
    const member = await this.membership.assertPermission(
      requireServerId(channel),
      userId,
      Permission.READ_MESSAGES,
    );
    this.assertChannelVisible(channel, member.role, userId);
    return channel;
  }

  async assertCanSend(channelId: string, userId: string): Promise<Channel> {
    const channel = await this.resolveChannel(channelId);
    if (channel.type === 'DM') {
      await this.assertDmMember(channelId, userId);
      return channel;
    }
    const member = await this.membership.assertPermission(
      requireServerId(channel),
      userId,
      Permission.SEND_MESSAGES,
    );
    this.assertChannelVisible(channel, member.role, userId);
    return channel;
  }

  private assertChannelVisible(
    channel: Channel,
    role: ServerRole,
    userId: string,
  ): void {
    if (canSeeChannel(role, channel.visibility)) return;
    if (channel.type === 'VOICE' && this.voice.isInChannel(channel.id, userId)) {
      return;
    }
    throw new ForbiddenException('Você não tem acesso a este canal');
  }

  private async assertDmMember(channelId: string, userId: string) {
    const member = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('Você não participa deste chat');
    }
    return member;
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
  ): Promise<{
    message: PublicMessage;
    serverId: string | null;
    dmRecipientId: string | null;
  }> {
    const channel = await this.assertCanSend(channelId, userId);

    const message = await this.prisma.message.create({
      data: {
        channelId,
        authorId: userId,
        content: dto.content,
        replyToId: dto.replyToId,
      },
      include: { author: true },
    });

    let dmRecipientId: string | null = null;
    if (channel.type === 'DM') {
      const other = await this.prisma.channelMember.findFirst({
        where: { channelId, userId: { not: userId } },
        select: { userId: true },
      });
      dmRecipientId = other?.userId ?? null;
    }

    return {
      message: toPublicMessage(message),
      serverId: channel.serverId,
      dmRecipientId,
    };
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
      if (channel.type === 'DM') {
        throw new ForbiddenException(
          'Você só pode apagar suas próprias mensagens',
        );
      }
      await this.membership.assertPermission(
        requireServerId(channel),
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
