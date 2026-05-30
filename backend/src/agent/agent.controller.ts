import { Controller, Get, Post } from '@nestjs/common';
import { AgentService } from './agent.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('agent')
export class AgentController {
  constructor(
    private agentService: AgentService,
    private prisma: PrismaService,
  ) {}

  @Post('run')
  runForMe(@CurrentUser('id') userId: string) {
    return this.agentService.runNowForUser(userId);
  }

  @Get('last-run')
  lastRun(@CurrentUser('id') userId: string) {
    return this.prisma.agentRun.findFirst({
      where: { userId },
      orderBy: { startedAt: 'desc' },
    });
  }
}
