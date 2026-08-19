import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Channel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { Permission } from '../common/permissions';

export interface VoiceParticipantRef {
  userId: string;
  socketId: string;
  displayName: string;
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async assertCanJoin(channelId: string, userId: string): Promise<Channel> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');
    if (channel.type !== 'VOICE') {
      throw new BadRequestException('Este canal não é uma sala de voz');
    }
    await this.membership.assertPermission(
      channel.serverId,
      userId,
      Permission.CONNECT_VOICE,
    );
    return channel;
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
    room.set(userId, { userId, socketId, displayName });
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
}
