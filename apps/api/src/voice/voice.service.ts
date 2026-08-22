import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Channel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { Permission, canSeeChannel } from '../common/permissions';

export interface VoiceParticipantRef {
  userId: string;
  socketId: string;
  displayName: string;
  micMuted: boolean;
}

export interface VoiceRosterParticipant {
  userId: string;
  displayName: string;
  micMuted: boolean;
  serverMuted: boolean;
}

export interface VoiceRosterRoom {
  channelId: string;
  participants: VoiceRosterParticipant[];
}

/**
 * In-memory voice room roster, scoped to this single Nest process. Fine for a self-hosted
 * single-instance deployment: sockets are already process-local, and a restart drops every
 * connection anyway, so there's nothing here that needs to survive past the live sockets.
 */
@Injectable()
export class VoiceService {
  private rooms = new Map<string, Map<string, VoiceParticipantRef>>();
  private socketLocation = new Map<
    string,
    { channelId: string; userId: string }
  >();
  /** Server-mute flags persist in-process until an admin unmutes (survives leave/rejoin). */
  private serverMutes = new Map<string, Set<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async assertCanJoin(channelId: string, userId: string): Promise<Channel> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');
    if (channel.type !== 'VOICE' || !channel.serverId) {
      throw new BadRequestException('Este canal não é uma sala de voz');
    }
    const member = await this.membership.assertPermission(
      channel.serverId,
      userId,
      Permission.CONNECT_VOICE,
    );
    if (
      !canSeeChannel(member.role, channel.visibility) &&
      !this.isInChannel(channelId, userId)
    ) {
      throw new ForbiddenException('Você não tem acesso a este canal');
    }
    return channel;
  }

  async assertCanShareScreen(channelId: string, userId: string): Promise<void> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');
    if (!channel.serverId) {
      throw new BadRequestException('Este canal não é uma sala de voz');
    }
    await this.membership.assertPermission(
      channel.serverId,
      userId,
      Permission.SHARE_SCREEN,
    );
  }

  async assertCanMuteMembers(
    channelId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');
    if (!channel.serverId) {
      throw new BadRequestException('Este canal não é uma sala de voz');
    }
    await this.membership.assertCanManageMember(
      channel.serverId,
      actorUserId,
      targetUserId,
      Permission.MUTE_MEMBERS,
    );
  }

  async assertCanMoveMembers(
    channelId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');
    if (!channel.serverId) {
      throw new BadRequestException('Este canal não é uma sala de voz');
    }
    await this.membership.assertCanManageMember(
      channel.serverId,
      actorUserId,
      targetUserId,
      Permission.MOVE_MEMBERS,
    );
  }

  async assertCanMoveInto(
    destinationChannelId: string,
    actorUserId: string,
  ): Promise<void> {
    const dest = await this.prisma.channel.findUnique({
      where: { id: destinationChannelId },
    });
    if (!dest) throw new NotFoundException('Canal não encontrado');
    if (dest.type !== 'VOICE' || !dest.serverId) {
      throw new BadRequestException('O destino não é uma sala de voz');
    }
    const actor = await this.membership.getMembership(
      dest.serverId,
      actorUserId,
    );
    if (!canSeeChannel(actor.role, dest.visibility)) {
      throw new ForbiddenException('Você não tem acesso a este canal');
    }
  }

  /**
   * Relocates a live participant to another voice channel on the same server.
   * Returns the moved ref plus both channels so the gateway can rewire socket rooms.
   */
  async moveParticipant(
    fromChannelId: string,
    toChannelId: string,
    targetUserId: string,
  ): Promise<{
    participant: VoiceParticipantRef;
    from: Channel;
    to: Channel;
  }> {
    if (fromChannelId === toChannelId) {
      throw new BadRequestException('O usuário já está nesta sala');
    }
    const [from, to] = await Promise.all([
      this.prisma.channel.findUnique({ where: { id: fromChannelId } }),
      this.prisma.channel.findUnique({ where: { id: toChannelId } }),
    ]);
    if (!from || !to) throw new NotFoundException('Canal não encontrado');
    if (from.serverId !== to.serverId) {
      throw new BadRequestException('As salas precisam ser do mesmo servidor');
    }
    if (to.type !== 'VOICE') {
      throw new BadRequestException('O destino não é uma sala de voz');
    }
    const participant = this.rooms.get(fromChannelId)?.get(targetUserId);
    if (!participant) {
      throw new BadRequestException('Este usuário não está nesta sala de voz');
    }
    this.leave(fromChannelId, targetUserId);
    this.join(
      toChannelId,
      participant.userId,
      participant.socketId,
      participant.displayName,
    );
    return { participant, from, to };
  }

  /** Joins the room and returns the participants that were already there (before this join). */
  join(
    channelId: string,
    userId: string,
    socketId: string,
    displayName: string,
  ): VoiceParticipantRef[] {
    this.leaveBySocket(socketId);
    const room =
      this.rooms.get(channelId) ?? new Map<string, VoiceParticipantRef>();
    const others = Array.from(room.values());
    room.set(userId, {
      userId,
      socketId,
      displayName,
      micMuted: this.isServerMuted(channelId, userId),
    });
    this.rooms.set(channelId, room);
    this.socketLocation.set(socketId, { channelId, userId });
    return others;
  }

  /** Removes a participant by channel+user. Returns true if they were actually in the room. */
  leave(channelId: string, userId: string): boolean {
    const room = this.rooms.get(channelId);
    const participant = room?.get(userId);
    if (!room || !participant) return false;
    room.delete(userId);
    if (room.size === 0) this.rooms.delete(channelId);
    this.socketLocation.delete(participant.socketId);
    return true;
  }

  /** Removes whichever room this socket was in, if any, and reports where it was. */
  leaveBySocket(
    socketId: string,
  ): { channelId: string; userId: string } | undefined {
    const location = this.socketLocation.get(socketId);
    if (!location) return undefined;
    this.leave(location.channelId, location.userId);
    return location;
  }

  getParticipants(channelId: string): VoiceParticipantRef[] {
    return Array.from(this.rooms.get(channelId)?.values() ?? []);
  }

  findSocketId(channelId: string, userId: string): string | undefined {
    return this.rooms.get(channelId)?.get(userId)?.socketId;
  }

  isParticipant(channelId: string, userId: string, socketId: string): boolean {
    return this.rooms.get(channelId)?.get(userId)?.socketId === socketId;
  }

  isInChannel(channelId: string, userId: string): boolean {
    return this.rooms.get(channelId)?.has(userId) ?? false;
  }

  channelIdsForUser(userId: string): string[] {
    const ids: string[] = [];
    for (const [channelId, room] of this.rooms) {
      if (room.has(userId)) ids.push(channelId);
    }
    return ids;
  }

  setMicMuted(channelId: string, userId: string, muted: boolean): void {
    const participant = this.rooms.get(channelId)?.get(userId);
    if (participant) participant.micMuted = muted;
  }

  isServerMuted(channelId: string, userId: string): boolean {
    return this.serverMutes.get(channelId)?.has(userId) ?? false;
  }

  setServerMute(channelId: string, userId: string, muted: boolean): void {
    const set = this.serverMutes.get(channelId) ?? new Set<string>();
    if (muted) {
      set.add(userId);
      this.serverMutes.set(channelId, set);
      this.setMicMuted(channelId, userId, true);
    } else {
      set.delete(userId);
      if (set.size === 0) this.serverMutes.delete(channelId);
      else this.serverMutes.set(channelId, set);
    }
  }

  toRosterParticipant(
    channelId: string,
    p: VoiceParticipantRef,
  ): VoiceRosterParticipant {
    return {
      userId: p.userId,
      displayName: p.displayName,
      micMuted: p.micMuted || this.isServerMuted(channelId, p.userId),
      serverMuted: this.isServerMuted(channelId, p.userId),
    };
  }

  getRoster(): VoiceRosterRoom[] {
    return Array.from(this.rooms.entries()).map(([channelId, room]) => ({
      channelId,
      participants: Array.from(room.values()).map((p) =>
        this.toRosterParticipant(channelId, p),
      ),
    }));
  }
}
