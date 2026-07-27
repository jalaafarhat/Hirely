import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    // Always return HTTP 200 once the process is up so Railway healthchecks
    // pass even if Postgres is briefly unavailable after deploy.
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', service: 'hirely-api', database: 'connected' };
    } catch {
      return {
        status: 'ok',
        service: 'hirely-api',
        database: 'disconnected',
      };
    }
  }
}
