import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

const TTL_SECONDS = 3600;

/**
 * RTCHIBRIDO.mp princípio 10 — "usar TURN apenas quando a conexão P2P direta
 * não for possível". STUN alone only tells peers their public address; behind
 * a symmetric NAT or a locked-down firewall that's not enough and the mic/cam
 * mesh just fails to connect with no fallback. TURN relays media through a
 * server in that case.
 *
 * Generates short-lived credentials for coturn's `--use-auth-secret` REST API
 * scheme (a shared secret both sides know, never sent to the client) instead
 * of static long-lived TURN credentials, so a leaked username/credential pair
 * only opens the relay for an hour rather than forever.
 */
@Injectable()
export class TurnService {
  private readonly logger = new Logger(TurnService.name);
  private warned = false;

  constructor(private readonly config: ConfigService) {}

  getIceServers(userId: string): IceServer[] {
    const stun: IceServer = { urls: 'stun:stun.l.google.com:19302' };

    const secret = this.config.get<string>('TURN_SECRET')?.trim();
    const host = this.config.get<string>('TURN_HOST')?.trim();
    if (!secret || !host) {
      if (!this.warned) {
        this.warned = true;
        this.logger.warn(
          'TURN_SECRET/TURN_HOST not set — voice/camera P2P has no TURN fallback, so calls between peers behind a symmetric NAT or restrictive firewall will fail to connect.',
        );
      }
      return [stun];
    }

    const port = this.config.get<string>('TURN_PORT', '3478');
    const username = `${Math.floor(Date.now() / 1000) + TTL_SECONDS}:${userId}`;
    const credential = createHmac('sha1', secret)
      .update(username)
      .digest('base64');

    return [
      stun,
      { urls: `turn:${host}:${port}?transport=udp`, username, credential },
      { urls: `turn:${host}:${port}?transport=tcp`, username, credential },
    ];
  }
}
