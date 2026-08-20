import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import * as mediasoup from 'mediasoup';
import type { types as MediasoupTypes } from 'mediasoup';
import { MEDIA_CODECS } from './sfu.config';

interface TransportEntry {
  transport: MediasoupTypes.WebRtcTransport;
  channelId: string;
  userId: string;
}

interface ProducerEntry {
  producer: MediasoupTypes.Producer;
  channelId: string;
  userId: string;
  /** RTCHIBRIDO.mp Parte 4: how many consumers are subscribed right now. */
  viewerCount: number;
}

export interface ViewerCountChange {
  producerId: string;
  ownerUserId: string;
  viewerCount: number;
}

interface ConsumerEntry {
  consumer: MediasoupTypes.Consumer;
  channelId: string;
  userId: string;
}

export interface TransportParams {
  id: string;
  iceParameters: MediasoupTypes.IceParameters;
  iceCandidates: MediasoupTypes.IceCandidate[];
  dtlsParameters: MediasoupTypes.DtlsParameters;
}

export interface ConsumerParams {
  id: string;
  producerId: string;
  producerUserId: string;
  kind: MediasoupTypes.MediaKind;
  rtpParameters: MediasoupTypes.RtpParameters;
}

/**
 * Screen-share SFU. Voice/camera stay on the P2P mesh (small groups, already
 * cheap); this only handles the "transmissão" side of RTCHIBRIDO.mp — one
 * publisher per voice channel, fanned out through mediasoup instead of a
 * per-viewer WebRTC connection.
 *
 * One Router per voice channel, created lazily on first use and torn down
 * once nothing references it. A single Worker is enough for a small
 * self-hosted deployment; split into a pool if channel count ever justifies it.
 */
@Injectable()
export class SfuService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SfuService.name);
  private worker: MediasoupTypes.Worker;
  private announcedIp: string | undefined;
  private announcedIpResolved = false;

  private readonly routers = new Map<string, MediasoupTypes.Router>();
  private readonly transports = new Map<string, TransportEntry>();
  private readonly producers = new Map<string, ProducerEntry>();
  private readonly consumers = new Map<string, ConsumerEntry>();
  private readonly events = new EventEmitter();

  /** RTCHIBRIDO.mp Parte 4 — fires whenever a producer's live viewer count changes. */
  onViewerCountChange(listener: (change: ViewerCountChange) => void): void {
    this.events.on('viewerCountChange', listener);
  }

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: Number(this.config.get('MEDIASOUP_MIN_PORT') ?? 40000),
      rtcMaxPort: Number(this.config.get('MEDIASOUP_MAX_PORT') ?? 40099),
    });
    this.worker.on('died', () => {
      this.logger.error(
        'mediasoup worker died — screen share via SFU is unavailable until the API restarts',
      );
    });
    await this.resolveAnnouncedIp();
  }

  onModuleDestroy() {
    this.worker?.close();
  }

  private async getOrCreateRouter(
    channelId: string,
  ): Promise<MediasoupTypes.Router> {
    let router = this.routers.get(channelId);
    if (!router) {
      router = await this.worker.createRouter({ mediaCodecs: MEDIA_CODECS });
      this.routers.set(channelId, router);
    }
    return router;
  }

  private maybeCloseRouter(channelId: string) {
    const stillUsed = [...this.transports.values()].some(
      (entry) => entry.channelId === channelId,
    );
    if (stillUsed) return;
    const router = this.routers.get(channelId);
    router?.close();
    this.routers.delete(channelId);
  }

  async getRouterRtpCapabilities(
    channelId: string,
  ): Promise<MediasoupTypes.RtpCapabilities> {
    const router = await this.getOrCreateRouter(channelId);
    return router.rtpCapabilities;
  }

  /**
   * Public IPv4 stamped into ICE candidates. Browsers outside Docker cannot
   * reach 172.x, so an empty/loopback MEDIASOUP_ANNOUNCED_IP is treated as
   * unset and we try to detect the host's egress address instead.
   */
  async resolveAnnouncedIp(): Promise<string | undefined> {
    if (this.announcedIpResolved) return this.announcedIp;
    this.announcedIpResolved = true;

    const configured = this.config
      .get<string>('MEDIASOUP_ANNOUNCED_IP')
      ?.trim();
    if (configured && !isUnusableAnnouncedIp(configured)) {
      this.announcedIp = configured;
      this.logger.log(`mediasoup announced IP from env: ${this.announcedIp}`);
      return this.announcedIp;
    }

    const detected = await detectPublicIpv4();
    if (detected) {
      this.announcedIp = detected;
      this.logger.log(
        `mediasoup announced IP auto-detected: ${this.announcedIp}`,
      );
      return this.announcedIp;
    }

    this.logger.warn(
      'MEDIASOUP_ANNOUNCED_IP is unset and public IP auto-detect failed. Screen-share ICE will announce the container IP, which remote browsers cannot reach — viewers will see a black screen.',
    );
    return undefined;
  }

  async createTransport(
    channelId: string,
    userId: string,
  ): Promise<TransportParams> {
    const router = await this.getOrCreateRouter(channelId);
    const announcedIp = await this.resolveAnnouncedIp();
    const listenInfo = {
      ip: '0.0.0.0' as const,
      ...(announcedIp ? { announcedAddress: announcedIp } : {}),
    };
    const transport = await router.createWebRtcTransport({
      listenInfos: [
        { ...listenInfo, protocol: 'udp' },
        { ...listenInfo, protocol: 'tcp' },
      ],
      initialAvailableOutgoingBitrate: 1_000_000,
    });
    this.transports.set(transport.id, { transport, channelId, userId });

    const iceSummary = transport.iceCandidates
      .map(
        (candidate) =>
          `${candidate.ip}:${candidate.port}/${candidate.protocol}`,
      )
      .join(', ');
    this.logger.log(
      `SFU transport ${transport.id} ICE ${iceSummary || '(none)'}`,
    );
    if (
      transport.iceCandidates.some((candidate) => isPrivateIpv4(candidate.ip))
    ) {
      this.logger.warn(
        "ICE candidates include a private IP — remote viewers will see a black screen unless they are on the same LAN. Set MEDIASOUP_ANNOUNCED_IP to this host's public IPv4.",
      );
    }

    transport.on('dtlsstatechange', (state) => {
      this.logger.debug(
        `transport ${transport.id} dtlsstatechange -> ${state}`,
      );
      if (state === 'closed' || state === 'failed') {
        this.transports.delete(transport.id);
        this.maybeCloseRouter(channelId);
      }
    });
    transport.on('icestatechange', (state) => {
      this.logger.log(`transport ${transport.id} icestatechange -> ${state}`);
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  private getOwnTransport(transportId: string, userId: string): TransportEntry {
    const entry = this.transports.get(transportId);
    if (!entry || entry.userId !== userId) {
      throw new BadRequestException('Transport SFU inválido');
    }
    return entry;
  }

  async connectTransport(
    transportId: string,
    userId: string,
    dtlsParameters: MediasoupTypes.DtlsParameters,
  ): Promise<void> {
    const { transport } = this.getOwnTransport(transportId, userId);
    await transport.connect({ dtlsParameters });
  }

  async produce(
    transportId: string,
    userId: string,
    kind: MediasoupTypes.MediaKind,
    rtpParameters: MediasoupTypes.RtpParameters,
  ): Promise<{ id: string; channelId: string }> {
    const { transport, channelId } = this.getOwnTransport(transportId, userId);
    const producer = await transport.produce({ kind, rtpParameters });
    // RTCHIBRIDO.mp Parte 4: nobody's watching yet at the moment a share
    // starts — hold it paused (near-zero upload) until the first viewer subscribes.
    await producer.pause();
    this.producers.set(producer.id, {
      producer,
      channelId,
      userId,
      viewerCount: 0,
    });

    producer.on('transportclose', () => {
      this.producers.delete(producer.id);
    });

    return { id: producer.id, channelId };
  }

  /** Producer transitioning 0→1 viewers resumes it; this is the only place that un-pauses a share. */
  private addViewer(producerId: string): void {
    const entry = this.producers.get(producerId);
    if (!entry) return;
    entry.viewerCount += 1;
    if (entry.viewerCount === 1) {
      entry.producer.resume().catch((err: unknown) => {
        this.logger.warn(`failed to resume producer ${producerId}: ${err}`);
      });
      this.logger.log(`producer ${producerId} resumed (1 espectador)`);
    }
    this.events.emit('viewerCountChange', {
      producerId,
      ownerUserId: entry.userId,
      viewerCount: entry.viewerCount,
    } satisfies ViewerCountChange);
  }

  /** Producer transitioning to 0 viewers pauses it — the "otimização por número de espectadores" from RTCHIBRIDO.mp. */
  private removeViewer(producerId: string): void {
    const entry = this.producers.get(producerId);
    if (!entry) return;
    entry.viewerCount = Math.max(0, entry.viewerCount - 1);
    if (entry.viewerCount === 0) {
      entry.producer.pause().catch((err: unknown) => {
        this.logger.warn(`failed to pause producer ${producerId}: ${err}`);
      });
      this.logger.log(`producer ${producerId} paused (0 espectadores)`);
    }
    this.events.emit('viewerCountChange', {
      producerId,
      ownerUserId: entry.userId,
      viewerCount: entry.viewerCount,
    } satisfies ViewerCountChange);
  }

  private closeConsumerEntry(consumerId: string): void {
    const entry = this.consumers.get(consumerId);
    if (!entry) return;
    entry.consumer.close();
    this.consumers.delete(consumerId);
    this.removeViewer(entry.consumer.producerId);
  }

  /** Producers already live in this channel — used so a viewer joining mid-share can catch up. */
  listProducers(
    channelId: string,
    excludingUserId?: string,
  ): { producerId: string; userId: string; kind: MediasoupTypes.MediaKind }[] {
    return [...this.producers.values()]
      .filter(
        (entry) =>
          entry.channelId === channelId && entry.userId !== excludingUserId,
      )
      .map((entry) => ({
        producerId: entry.producer.id,
        userId: entry.userId,
        kind: entry.producer.kind,
      }));
  }

  async consume(
    transportId: string,
    userId: string,
    producerId: string,
    rtpCapabilities: MediasoupTypes.RtpCapabilities,
  ): Promise<ConsumerParams> {
    const { transport, channelId } = this.getOwnTransport(transportId, userId);
    const producerEntry = this.producers.get(producerId);
    if (!producerEntry || producerEntry.channelId !== channelId) {
      throw new BadRequestException('Produtor SFU não encontrado');
    }
    const router = await this.getOrCreateRouter(channelId);
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new BadRequestException('Cliente não suporta este stream');
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });
    this.consumers.set(consumer.id, { consumer, channelId, userId });
    this.addViewer(producerId);

    // The consumer is already gone by the time either of these fires — just
    // drop our bookkeeping and count the viewer as gone. producerclose needs
    // no removeViewer() call: the producer itself (and its entry) is gone.
    consumer.on('transportclose', () => {
      this.consumers.delete(consumer.id);
      this.removeViewer(producerId);
    });
    consumer.on('producerclose', () => this.consumers.delete(consumer.id));

    return {
      id: consumer.id,
      producerId,
      producerUserId: producerEntry.userId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async resumeConsumer(consumerId: string, userId: string): Promise<void> {
    const entry = this.consumers.get(consumerId);
    if (!entry || entry.userId !== userId) return;
    await entry.consumer.resume();
  }

  /** Explicit unsubscribe — called when a viewer stops watching a screen share that's still live. */
  closeConsumer(consumerId: string, userId: string): void {
    const entry = this.consumers.get(consumerId);
    if (!entry || entry.userId !== userId) return;
    this.closeConsumerEntry(consumerId);
  }

  /** Closes a user's producer(s) in a channel (screen share stopped). Returns their ids for the caller to broadcast. */
  closeProducers(channelId: string, userId: string): string[] {
    const closed: string[] = [];
    for (const [id, entry] of this.producers) {
      if (entry.channelId === channelId && entry.userId === userId) {
        entry.producer.close();
        this.producers.delete(id);
        closed.push(id);
      }
    }
    return closed;
  }

  /** Tears down every transport/producer/consumer this user owns in a channel — call on voice leave/disconnect. */
  cleanupUser(channelId: string, userId: string): string[] {
    const closedProducerIds = this.closeProducers(channelId, userId);

    for (const [id, entry] of [...this.consumers]) {
      if (entry.channelId === channelId && entry.userId === userId) {
        this.closeConsumerEntry(id);
      }
    }
    for (const [id, entry] of this.transports) {
      if (entry.channelId === channelId && entry.userId === userId) {
        entry.transport.close();
        this.transports.delete(id);
      }
    }

    this.maybeCloseRouter(channelId);
    return closedProducerIds;
  }
}

function isUnusableAnnouncedIp(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '0.0.0.0' ||
    ip === '::' ||
    ip === '::1' ||
    ip === 'localhost'
  );
}

function isPrivateIpv4(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith('127.') ||
    ip === '0.0.0.0'
  );
}

async function detectPublicIpv4(): Promise<string | undefined> {
  const urls = ['https://api.ipify.org', 'https://ipv4.icanhazip.com'];
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) continue;
      const ip = (await response.text()).trim();
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && !isPrivateIpv4(ip)) return ip;
    } catch {
      // try the next source
    }
  }
  return undefined;
}
