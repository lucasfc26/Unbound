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
import type { types as MediasoupTypes } from 'mediasoup';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import {
  PresenceService,
  SETTABLE_STATUSES,
} from '../presence/presence.service';
import { VoiceService } from '../voice/voice.service';
import { TurnService } from '../voice/turn.service';
import { LinkPreviewService } from '../link-preview/link-preview.service';
import { SfuService } from '../sfu/sfu.service';
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
    private readonly turn: TurnService,
    private readonly linkPreview: LinkPreviewService,
    private readonly sfu: SfuService,
    private readonly emitter: RealtimeEmitterService,
  ) {}

  afterInit(server: Server) {
    this.emitter.setServer(server);
    // RTCHIBRIDO.mp Parte 4 — only the sharer needs to know how many people
    // are watching (drives the "assistindo" indicator, not a room broadcast).
    this.sfu.onViewerCountChange(({ producerId, ownerUserId, viewerCount }) => {
      this.server
        .to(this.userRoom(ownerUserId))
        .emit('sfu:viewer_count', { producerId, viewerCount });
    });
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
      this.cleanupSfuForUser(leftVoice.channelId, leftVoice.userId);
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
      micMuted: this.voice.isServerMuted(data.channelId, client.data.user.id),
      serverMuted: this.voice.isServerMuted(
        data.channelId,
        client.data.user.id,
      ),
    });

    return {
      participants: others.map((p) =>
        this.voice.toRosterParticipant(data.channelId, p),
      ),
      serverMuted: this.voice.isServerMuted(
        data.channelId,
        client.data.user.id,
      ),
      // RTCHIBRIDO.mp princípio 10 — só entra na resposta do join porque o
      // mesh P2P (mic/câmera) é criado logo em seguida a partir dela; STUN
      // sozinho não basta para NAT simétrico/firewall restritivo.
      iceServers: this.turn.getIceServers(client.data.user.id),
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
    this.cleanupSfuForUser(data.channelId, client.data.user.id);
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
    if (
      !data.muted &&
      this.voice.isServerMuted(data.channelId, client.data.user.id)
    ) {
      return;
    }
    this.voice.setMicMuted(data.channelId, client.data.user.id, data.muted);
    this.server.emit('voice:mic_state', {
      channelId: data.channelId,
      userId: client.data.user.id,
      muted: data.muted,
    });
  }

  @SubscribeMessage('voice:sync')
  onVoiceSync() {
    return this.voice.getRoster();
  }

  @SubscribeMessage('voice:ping')
  onVoicePing() {
    return { ok: true };
  }

  @SubscribeMessage('voice:cue')
  onVoiceCue(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string; cue: string },
  ) {
    if (
      !this.voice.isParticipant(data.channelId, client.data.user.id, client.id)
    ) {
      return;
    }
    const allowed = new Set([
      'join',
      'leave',
      'move',
      'stream',
      'watch',
      'mute',
      'unmute',
      'deafen',
    ]);
    if (!allowed.has(data.cue)) return;
    client.to(this.voiceRoom(data.channelId)).emit('voice:cue', {
      channelId: data.channelId,
      cue: data.cue,
    });
  }

  @SubscribeMessage('voice:move')
  async onVoiceMove(
    @ConnectedSocket() client: AppSocket,
    @MessageBody()
    data: {
      channelId: string;
      targetUserId: string;
      destinationChannelId: string;
    },
  ) {
    await this.voice.assertCanMoveMembers(
      data.channelId,
      client.data.user.id,
      data.targetUserId,
    );
    const { participant, from, to } = await this.voice.moveParticipant(
      data.channelId,
      data.destinationChannelId,
      data.targetUserId,
    );

    const targetSocket = this.server.sockets.sockets.get(participant.socketId);
    if (targetSocket) {
      targetSocket.leave(this.voiceRoom(from.id));
      await targetSocket.join(this.voiceRoom(to.id));
    }

    this.cleanupSfuForUser(from.id, participant.userId);

    this.server.emit('voice:leave', {
      channelId: from.id,
      userId: participant.userId,
    });
    this.server.emit('voice:join', {
      channelId: to.id,
      userId: participant.userId,
      displayName: participant.displayName,
      micMuted: participant.micMuted,
      serverMuted: this.voice.isServerMuted(to.id, participant.userId),
    });
    this.server.to(participant.socketId).emit('voice:moved', {
      fromChannelId: from.id,
      toChannelId: to.id,
      serverId: to.serverId,
    });
  }

  @SubscribeMessage('voice:server_mute')
  async onVoiceServerMute(
    @ConnectedSocket() client: AppSocket,
    @MessageBody()
    data: { channelId: string; targetUserId: string; muted: boolean },
  ) {
    await this.voice.assertCanMuteMembers(
      data.channelId,
      client.data.user.id,
      data.targetUserId,
    );
    this.voice.setServerMute(data.channelId, data.targetUserId, data.muted);
    this.server.emit('voice:server_mute', {
      channelId: data.channelId,
      userId: data.targetUserId,
      muted: data.muted,
    });
    if (data.muted) {
      this.server.emit('voice:mic_state', {
        channelId: data.channelId,
        userId: data.targetUserId,
        muted: true,
      });
    }
  }

  @SubscribeMessage('sfu:get_rtp_capabilities')
  async onSfuGetRtpCapabilities(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string },
  ) {
    this.assertVoiceParticipant(client, data.channelId);
    return this.sfu.getRouterRtpCapabilities(data.channelId);
  }

  @SubscribeMessage('sfu:create_transport')
  async onSfuCreateTransport(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string },
  ) {
    this.assertVoiceParticipant(client, data.channelId);
    return this.sfu.createTransport(data.channelId, client.data.user.id);
  }

  @SubscribeMessage('sfu:connect_transport')
  async onSfuConnectTransport(
    @ConnectedSocket() client: AppSocket,
    @MessageBody()
    data: {
      transportId: string;
      dtlsParameters: MediasoupTypes.DtlsParameters;
    },
  ) {
    await this.sfu.connectTransport(
      data.transportId,
      client.data.user.id,
      data.dtlsParameters,
    );
    // NestJS's socket.io adapter drops the ack entirely for a nil (void)
    // handler result (it filters with isNil before calling it) — the client
    // would otherwise wait out its ack timeout even though this succeeded.
    return {};
  }

  @SubscribeMessage('sfu:produce')
  async onSfuProduce(
    @ConnectedSocket() client: AppSocket,
    @MessageBody()
    data: {
      channelId: string;
      transportId: string;
      kind: MediasoupTypes.MediaKind;
      rtpParameters: MediasoupTypes.RtpParameters;
    },
  ) {
    this.assertVoiceParticipant(client, data.channelId);
    await this.voice.assertCanShareScreen(data.channelId, client.data.user.id);

    const { id } = await this.sfu.produce(
      data.transportId,
      client.data.user.id,
      data.kind,
      data.rtpParameters,
    );

    client.to(this.voiceRoom(data.channelId)).emit('sfu:new_producer', {
      channelId: data.channelId,
      producerId: id,
      userId: client.data.user.id,
      kind: data.kind,
    });

    return { id };
  }

  /**
   * Transmissão > Manual > Transporte = P2P: the screen goes straight over
   * the existing WebRTC mesh (see voice.gateway's offer/answer relay), so
   * there's no SFU producer to announce here — this is a pure signaling
   * relay (same trust model as voice:cue) telling the room to flip the
   * sharer's "sharingScreen" flag.
   */
  @SubscribeMessage('voice:screen_share_state')
  async onVoiceScreenShareState(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string; sharing: boolean },
  ) {
    this.assertVoiceParticipant(client, data.channelId);
    if (data.sharing) {
      await this.voice.assertCanShareScreen(
        data.channelId,
        client.data.user.id,
      );
    }

    client.to(this.voiceRoom(data.channelId)).emit('voice:screen_share_state', {
      channelId: data.channelId,
      userId: client.data.user.id,
      sharing: data.sharing,
    });
  }

  /** Existing producers for a channel — lets a viewer who joined mid-share catch up. */
  @SubscribeMessage('sfu:list_producers')
  onSfuListProducers(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string },
  ) {
    this.assertVoiceParticipant(client, data.channelId);
    return this.sfu.listProducers(data.channelId, client.data.user.id);
  }

  @SubscribeMessage('sfu:consume')
  async onSfuConsume(
    @ConnectedSocket() client: AppSocket,
    @MessageBody()
    data: {
      transportId: string;
      producerId: string;
      rtpCapabilities: MediasoupTypes.RtpCapabilities;
    },
  ) {
    return this.sfu.consume(
      data.transportId,
      client.data.user.id,
      data.producerId,
      data.rtpCapabilities,
    );
  }

  @SubscribeMessage('sfu:resume_consumer')
  async onSfuResumeConsumer(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { consumerId: string },
  ) {
    await this.sfu.resumeConsumer(data.consumerId, client.data.user.id);
    return {};
  }

  /** Fire-and-forget — a viewer stopped watching a still-live share, free the SFU consumer. */
  @SubscribeMessage('sfu:close_consumer')
  onSfuCloseConsumer(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { consumerId: string },
  ) {
    this.sfu.closeConsumer(data.consumerId, client.data.user.id);
  }

  @SubscribeMessage('sfu:stop_producing')
  onSfuStopProducing(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { channelId: string },
  ) {
    const closedProducerIds = this.sfu.closeProducers(
      data.channelId,
      client.data.user.id,
    );
    for (const producerId of closedProducerIds) {
      client.to(this.voiceRoom(data.channelId)).emit('sfu:producer_closed', {
        channelId: data.channelId,
        userId: client.data.user.id,
        producerId,
      });
    }
  }

  private assertVoiceParticipant(client: AppSocket, channelId: string) {
    if (!this.voice.isParticipant(channelId, client.data.user.id, client.id)) {
      throw new BadRequestException('Você não está nesta sala de voz');
    }
  }

  /** Tears down every SFU transport/producer/consumer this user holds in the channel (voice leave/disconnect) and tells everyone else any active share ended. */
  private cleanupSfuForUser(channelId: string, userId: string) {
    const closedProducerIds = this.sfu.cleanupUser(channelId, userId);
    for (const producerId of closedProducerIds) {
      this.server.to(this.voiceRoom(channelId)).emit('sfu:producer_closed', {
        channelId,
        userId,
        producerId,
      });
    }
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
    const { message, dmRecipientId } = await this.messages.createMessage(
      data.channelId,
      client.data.user.id,
      data,
    );
    this.server.to(this.room(data.channelId)).emit('message:create', message);
    if (dmRecipientId) {
      this.emitter.emitToUser(dmRecipientId, 'dm:message', message);
    }
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
