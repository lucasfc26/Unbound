import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Sharp } from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type ImageFolder = 'avatars' | 'icons';

type SharpFactory = (
  input: Buffer,
  options?: { animated?: boolean },
) => Sharp;

// Load on first upload, not at process boot — a missing linux binary used
// to throw on `require('sharp')` while Nest was still importing modules,
// so the API never bound :3000 and nginx returned 502 on every route.
function getSharp(): SharpFactory {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require('sharp') as SharpFactory | { default: SharpFactory };
  const factory = typeof loaded === 'function' ? loaded : loaded.default;
  if (typeof factory !== 'function') {
    throw new InternalServerErrorException(
      'Processamento de imagem indisponível',
    );
  }
  return factory;
}

@Injectable()
export class ImageStorageService {
  async saveSquare(
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    folder: ImageFolder,
    previousUrl?: string | null,
    size = 512,
  ): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie uma imagem de até 5 MB');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('A imagem deve ter no máximo 5 MB');
    }
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Use uma imagem JPG, PNG, WEBP ou GIF');
    }

    let output: Buffer;
    try {
      output = await getSharp()(file.buffer, { animated: false })
        .rotate()
        .resize(size, size, { fit: 'cover', position: 'centre' })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new BadRequestException('Não foi possível processar essa imagem');
    }

    const dir = join(process.cwd(), 'uploads', folder);
    mkdirSync(dir, { recursive: true });
    const filename = `${randomBytes(8).toString('hex')}.webp`;
    writeFileSync(join(dir, filename), output);
    this.removeStored(previousUrl, folder);
    return `/uploads/${folder}/${filename}`;
  }

  removeStored(url: string | null | undefined, folder: ImageFolder): void {
    if (!url) return;
    const prefix = `/uploads/${folder}/`;
    if (!url.startsWith(prefix)) return;
    const name = basename(url.slice(prefix.length));
    if (!name || name !== url.slice(prefix.length)) return;
    const path = join(process.cwd(), 'uploads', folder, name);
    if (existsSync(path)) unlinkSync(path);
  }
}
