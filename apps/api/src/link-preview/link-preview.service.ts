import { Injectable, Logger } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  toPublicMessage,
  type PublicMessage,
} from '../messages/message.presenter';
import { extractFirstUrl } from './link-preview.util';

export interface LinkPreviewData {
  url: string;
  siteName: string;
  title: string;
  description?: string;
  domain: string;
}

const FETCH_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const SUCCESS_CACHE_TTL_SECONDS = 24 * 60 * 60;
const FAILURE_CACHE_TTL_SECONDS = 10 * 60;

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Fetches (or reuses a cached) preview for the first URL in `content` and persists it onto
   * the message. Returns the updated message so the caller can broadcast it, or null if there's
   * no URL, no usable preview, or the message no longer matches (edited/deleted meanwhile).
   */
  async attach(
    messageId: string,
    content: string,
  ): Promise<PublicMessage | null> {
    const url = extractFirstUrl(content);
    if (!url) return null;

    const preview = await this.getPreview(url);
    if (!preview) return null;

    const current = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!current || current.deletedAt || !current.content.includes(url))
      return null;

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { linkPreview: preview as unknown as Prisma.InputJsonValue },
      include: { author: true },
    });
    return toPublicMessage(updated);
  }

  async getPreview(rawUrl: string): Promise<LinkPreviewData | null> {
    const cacheKey = this.cacheKey(rawUrl);
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return cached === '' ? null : (JSON.parse(cached) as LinkPreviewData);
    }

    const preview = await this.fetchPreview(rawUrl).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Falha ao buscar preview de ${rawUrl}: ${message}`);
      return null;
    });

    await this.redis.set(
      cacheKey,
      preview ? JSON.stringify(preview) : '',
      'EX',
      preview ? SUCCESS_CACHE_TTL_SECONDS : FAILURE_CACHE_TTL_SECONDS,
    );
    return preview;
  }

  private cacheKey(url: string): string {
    return `linkpreview:${createHash('sha256').update(url).digest('hex')}`;
  }

  private async fetchPreview(rawUrl: string): Promise<LinkPreviewData | null> {
    let target = new URL(rawUrl);

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      await this.assertSafeUrl(target);

      const response = await fetch(target.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'UnboundLinkPreview/1.0' },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return null;
        target = new URL(location, target);
        continue;
      }

      if (!response.ok) return null;

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) return null;

      const contentLength = Number(
        response.headers.get('content-length') ?? '0',
      );
      if (contentLength > MAX_RESPONSE_BYTES) return null;

      const html = await this.readLimited(response, MAX_RESPONSE_BYTES);
      return this.parseHtml(html, target);
    }
    return null;
  }

  private async readLimited(
    response: Response,
    maxBytes: number,
  ): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return '';
    const decoder = new TextDecoder();
    let received = 0;
    let result = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      result += decoder.decode(value, { stream: true });
      if (received >= maxBytes) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    return result;
  }

  private parseHtml(html: string, target: URL): LinkPreviewData {
    const title =
      this.extractMeta(html, 'og:title') ??
      this.extractTag(html, 'title') ??
      target.hostname;
    const description =
      this.extractMeta(html, 'og:description') ??
      this.extractName(html, 'description');
    const siteName =
      this.extractMeta(html, 'og:site_name') ??
      target.hostname.replace(/^www\./, '');

    return {
      url: target.toString(),
      siteName: this.decodeEntities(siteName).slice(0, 100),
      title: this.decodeEntities(title).slice(0, 200),
      description: description
        ? this.decodeEntities(description).slice(0, 300)
        : undefined,
      domain: target.hostname.replace(/^www\./, ''),
    };
  }

  private extractMeta(html: string, property: string): string | undefined {
    return this.matchAttrPair(html, 'property', property);
  }

  private extractName(html: string, name: string): string | undefined {
    return this.matchAttrPair(html, 'name', name);
  }

  private matchAttrPair(
    html: string,
    attr: string,
    value: string,
  ): string | undefined {
    const patterns = [
      new RegExp(
        `<meta[^>]+${attr}=["']${value}["'][^>]*content=["']([^"']*)["']`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${value}["']`,
        'i',
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }

  private extractTag(html: string, tag: string): string | undefined {
    return html
      .match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'))?.[1]
      ?.trim();
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  /** Blocks non-http(s) schemes, embedded credentials, and hosts resolving to private/loopback/link-local addresses. */
  private async assertSafeUrl(url: URL): Promise<void> {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Protocolo não permitido: ${url.protocol}`);
    }
    if (url.username || url.password) {
      throw new Error('URL com credenciais não é permitida');
    }

    const hostname = url.hostname;
    if (hostname.toLowerCase() === 'localhost')
      throw new Error('Host bloqueado');

    const addresses = isIP(hostname)
      ? [hostname]
      : (await lookup(hostname, { all: true })).map((entry) => entry.address);

    if (addresses.length === 0)
      throw new Error('Não foi possível resolver o host');
    for (const address of addresses) {
      if (this.isPrivateAddress(address)) {
        throw new Error(`Endereço bloqueado: ${address}`);
      }
    }
  }

  private isPrivateAddress(address: string): boolean {
    if (isIP(address) === 4) {
      const [a, b] = address.split('.').map(Number);
      if (a === 127 || a === 10 || a === 0) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a >= 224) return true;
      return false;
    }
    if (isIP(address) === 6) {
      const normalized = address.toLowerCase();
      if (normalized === '::1') return true;
      if (/^fe[89ab]/.test(normalized)) return true;
      if (normalized.startsWith('fc') || normalized.startsWith('fd'))
        return true;
      if (normalized.startsWith('::ffff:')) {
        const embedded = normalized.split(':').pop()!;
        if (isIP(embedded) === 4) return this.isPrivateAddress(embedded);
      }
      return false;
    }
    return true;
  }
}
