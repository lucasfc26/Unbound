import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import * as helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { resolveAllowedOrigins } from './common/cors';
import { MulterExceptionFilter } from './common/multer-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(
    helmet.default({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new MulterExceptionFilter());

  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(join(uploadsDir, 'avatars'), { recursive: true });
  mkdirSync(join(uploadsDir, 'icons'), { recursive: true });
  // Desktop installers/update artifacts — lives on the same persistent
  // volume as avatars, so it survives `docker compose up --build frontend`
  // instead of depending on a gitignored file making it into that image's
  // build context (the previous setup — the landing page ended up serving
  // its own index.html as the "installer" whenever that step was missed).
  mkdirSync(join(uploadsDir, 'releases'), { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  app.enableCors({
    origin: resolveAllowedOrigins(config.get<string>('FRONTEND_URL')),
    credentials: true,
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`API rodando em http://localhost:${port}`);
}
bootstrap();
