import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Lets REST-layer services push WebSocket broadcasts without depending on the gateway
 * directly (which would create a circular module dependency). RealtimeGateway hands over
 * the live Socket.IO server once it's initialized; everyone else only ever calls `emit`.
 */
@Injectable()
export class RealtimeEmitterService {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  emit(event: string, payload: unknown): void {
    this.server?.emit(event, payload);
  }
}
