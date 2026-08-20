import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Sharp } from 'sharp';

// sharp 0.35 ships dual CJS/ESM typings; under Nest's CommonJS tsconfig the
// callable default isn't visible, so we bind the runtime CJS export ourselves.
const sharp = require('sharp') as (
  input: Buffer,
  options?: { animated?: boolean },
) => Sharp;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type ImageFolder = 'avatars' | 'icons';

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
      output = await sharp(file.buffer, { animated: false })
        .rotate()
        .resize(size, size, { fit: 'cover', position: 'centre' })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
    } catch {
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
