import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_BYTES } from './image-storage.service';

export const imageUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      cb(
        new BadRequestException('Use uma imagem JPG, PNG, WEBP ou GIF'),
        false,
      );
      return;
    }
    cb(null, true);
  },
};
