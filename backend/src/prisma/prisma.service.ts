import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      this.logger.warn(
        'Database not available at startup. Run: docker compose up -d postgres redis',
      );
      this.logger.warn(
        error instanceof Error ? error.message : 'Connection failed',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
