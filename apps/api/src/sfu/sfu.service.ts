import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  private readonly routers = new Map<string, MediasoupTypes.Router>();
  private readonly transports = new Map<string, TransportEntry>();
  private readonly producers = new Map<string, ProducerEntry>();
  private readonly consumers = new Map<string, ConsumerEntry>();

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

  async createTransport(
    channelId: string,
    userId: string,
    announcedIp: string | undefined,
  ): Promise<TransportParams> {
    const router = await this.getOrCreateRouter(channelId);
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp }],
      enableUdp: true,
      enableTcp: false,
      initialAvailableOutgoingBitrate: 1_000_000,
    });
    this.transports.set(transport.id, { transport, channelId, userId });

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
      this.logger.debug(`transport ${transport.id} icestatechange -> ${state}`);
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
    this.producers.set(producer.id, { producer, channelId, userId });

    producer.on('transportclose', () => {
      this.producers.delete(producer.id);
    });

    return { id: producer.id, channelId };
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

    consumer.on('transportclose', () => this.consumers.delete(consumer.id));
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

    for (const [id, entry] of this.consumers) {
      if (entry.channelId === channelId && entry.userId === userId) {
        entry.consumer.close();
        this.consumers.delete(id);
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
