import { BadRequestException, Logger, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { UserStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import {
  PresenceService,
  SETTABLE_STATUSES,
} from '../presence/presence.service';
import { VoiceService } from '../voice/voice.service';
import { LinkPreviewService } from '../link-preview/link-preview.service';
import { RealtimeEmitterService } from './realtime-emitter.service';
import { resolveAllowedOrigins } from '../common/cors';
import { WsExceptionFilter } from './ws-exception.filter';

interface VoiceSignalPayload {
  targetUserId: string;
  channelId: string;
  signal: { type: 'offer' | 'answer' | 'candidate'; data: unknown };
}

interface AuthenticatedSocketData {
  user: { id: string; username: string; displayName: string };
}

type AppSocket = Socket & { data: AuthenticatedSocketData };

@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  cors: {
    origin: resolveAllowedOrigins(process.env.FRONTEND_URL),
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly presence: PresenceService,
    private readonly voice: VoiceService,
    private readonly linkPreview: LinkPreviewService,
    private readonly emitter: RealtimeEmitterService,
  ) {}

  afterInit(server: Server) {
    this.emitter.setServer(server);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('missing token');

      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      const user = await this.users.findById(payload.sub);
      if (!user) throw new Error('user not found');

      (client as AppSocket).data.user = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      };
      await client.join(this.userRoom(user.id));

      const { firstConnection } = await this.presence.connect(
        user.id,
        client.id,
      );
      if (firstConnection) {
        await this.users.setStatus(user.id, 'ONLINE');
        this.server.emit('user:online', { userId: user.id });
        this.server.emit('user:status', { userId: user.id, status: 'ONLINE' });
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
    const user = (client as AppSocket).data?.user;
    if (!user) return;

    const { lastConnection } = await this.presence.disconnect(
      user.id,
      client.id,
    );
    if (lastConnection) {
      await this.users.setStatus(user.id, 'OFFLINE');
      this.server.emit('user:offline', { userId: user.id });
    }

    const leftVoice = this.voice.leaveBySocket(client.id);
    if (leftVoice) {
      this.server.emit('voice:leave', {
        channelId: leftVoice.channelId,
        userId: leftVoice.userId,
      });
    }
  }

  @SubscribeMessage('presence:set_status')
  async onSetStatus(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { status: UserStatus },
  ) {
    if (!SETTABLE_STATUSES.includes(data.status)) {
      throw new BadRequestException('Status inválido');
    }

    await this.presence.setStatus(client.data.user.id, data.status);
    await this.users.setStatus(client.data.user.id, data.status);
    this.server.emit('user:status', {
      userId: client.data.user.id,
      status: this.presence.toPublicStatus(data.status),
    });
  }

  @SubscribeMessage('voice:join')
  async onVoiceJoin(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string },
  ) {
    await this.voice.assertCanJoin(data.channelId, client.data.user.id);
    const others = this.voice.join(
      data.channelId,
      client.data.user.id,
      client.id,
      client.data.user.displayName,
    );
    await client.join(this.voiceRoom(data.channelId));

    this.server.emit('voice:join', {
      channelId: data.channelId,
      userId: client.data.user.id,
      displayName: client.data.user.displayName,
    });

    return {
      participants: others.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
      })),
    };
  }

  @SubscribeMessage('voice:leave')
  onVoiceLeave(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string },
  ) {
    const left = this.voice.leave(data.channelId, client.data.user.id);
    if (!left) return;
    client.leave(this.voiceRoom(data.channelId));
    this.server.emit('voice:leave', {
      channelId: data.channelId,
      userId: client.data.user.id,
    });
  }

  @SubscribeMessage('voice:signal')
  onVoiceSignal(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: VoiceSignalPayload,
  ) {
    if (
      !this.voice.isParticipant(data.channelId, client.data.user.id, client.id)
    ) {
      throw new BadRequestException('Você não está nesta sala de voz');
    }

    const targetSocketId = this.voice.findSocketId(
      data.channelId,
      data.targetUserId,
    );
    if (!targetSocketId) return;

    this.server.to(targetSocketId).emit('voice:signal', {
      channelId: data.channelId,
      fromUserId: client.data.user.id,
      signal: data.signal,
    });
  }

  @SubscribeMessage('voice:mic_state')
  onVoiceMicState(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string; muted: boolean },
  ) {
    if (
      !this.voice.isParticipant(data.channelId, client.data.user.id, client.id)
    ) {
      return;
    }
    client.to(this.voiceRoom(data.channelId)).emit('voice:mic_state', {
      channelId: data.channelId,
      userId: client.data.user.id,
      muted: data.muted,
    });
  }

  @SubscribeMessage('voice:screen_share')
  onVoiceScreenShare(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string; sharing: boolean },
  ) {
    if (
      !this.voice.isParticipant(data.channelId, client.data.user.id, client.id)
    ) {
      return;
    }
    client.to(this.voiceRoom(data.channelId)).emit('voice:screen_share', {
      channelId: data.channelId,
      userId: client.data.user.id,
      sharing: data.sharing,
    });
  }

  @SubscribeMessage('channel:join')
  async onJoinChannel(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string },
  ) {
    await this.messages.assertCanRead(data.channelId, client.data.user.id);
    await client.join(this.room(data.channelId));
  }

  @SubscribeMessage('channel:leave')
  async onLeaveChannel(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string },
  ) {
    await client.leave(this.room(data.channelId));
  }

  @SubscribeMessage('message:create')
  async onCreateMessage(
    @ConnectedSocket() client: AppSocket,
    @MessageBody()
    data: { channelId: string; content: string; replyToId?: string },
  ) {
    const { message } = await this.messages.createMessage(
      data.channelId,
      client.data.user.id,
      data,
    );
    this.server.to(this.room(data.channelId)).emit('message:create', message);
    this.attachLinkPreview(message.id, message.content, data.channelId);
  }

  @SubscribeMessage('message:update')
  async onUpdateMessage(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    const { message, channelId } = await this.messages.updateMessage(
      data.messageId,
      client.data.user.id,
      data,
    );
    this.server.to(this.room(channelId)).emit('message:update', message);
    this.attachLinkPreview(message.id, message.content, channelId);
  }

  @SubscribeMessage('message:delete')
  async onDeleteMessage(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { messageId: string },
  ) {
    const { channelId, messageId } = await this.messages.deleteMessage(
      data.messageId,
      client.data.user.id,
    );
    this.server
      .to(this.room(channelId))
      .emit('message:delete', { id: messageId, channelId });
  }

  @SubscribeMessage('typing:start')
  async onTypingStart(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!(await this.canShareTypingStatus(client.data.user.id))) return;
    client.to(this.room(data.channelId)).emit('typing:start', {
      channelId: data.channelId,
      userId: client.data.user.id,
      displayName: client.data.user.displayName,
    });
  }

  @SubscribeMessage('typing:stop')
  async onTypingStop(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!(await this.canShareTypingStatus(client.data.user.id))) return;
    client.to(this.room(data.channelId)).emit('typing:stop', {
      channelId: data.channelId,
      userId: client.data.user.id,
    });
  }

  /** Privacidade > "Mostrar quando estiver digitando" — reads are unrestricted by RLS, so this needs no session context. */
  private async canShareTypingStatus(userId: string): Promise<boolean> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { shareTypingStatus: true },
    });
    return settings?.shareTypingStatus ?? true;
  }

  private room(channelId: string): string {
    return `channel:${channelId}`;
  }

  private voiceRoom(channelId: string): string {
    return `voice:${channelId}`;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  /** Fire-and-forget: fetching a link preview shouldn't hold up sending/editing the message itself. */
  private attachLinkPreview(
    messageId: string,
    content: string,
    channelId: string,
  ): void {
    this.linkPreview
      .attach(messageId, content)
      .then((updated) => {
        if (updated) {
          this.server.to(this.room(channelId)).emit('message:update', updated);
        }
      })
      .catch(() => {
        // best-effort enrichment — a failed fetch just means no preview
      });
  }
}
