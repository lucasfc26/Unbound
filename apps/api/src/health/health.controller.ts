import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    if (!database.ok || !redis.ok) {
      throw new ServiceUnavailableException({ database, redis });
    }

    return { status: 'ok', database, redis };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  private async checkRedis() {
    try {
      const pong = await this.redis.ping();
      return { ok: pong === 'PONG' };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
}
