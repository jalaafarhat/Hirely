import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/public.decorator';
import { Role } from '@prisma/client';

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get('users')
  getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page) : 1;
    const l = Math.min(limit ? parseInt(limit) : 20, 100);
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { jobMatches: true, emailLogs: true } },
      },
      skip: (p - 1) * l,
      take: l,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('cvs')
  getCVs() {
    return this.prisma.cvFile.findMany({
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        uploadedAt: true,
        user: { select: { email: true, name: true } },
      },
      orderBy: { uploadedAt: 'desc' },
      take: 100,
    });
  }

  @Get('jobs')
  getJobs(@Query('page') page?: string) {
    const p = page ? parseInt(page) : 1;
    return this.prisma.job.findMany({
      skip: (p - 1) * 20,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { matches: true } } },
    });
  }

  @Get('email-logs')
  getEmailLogs() {
    return this.prisma.emailLog.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('agent-runs')
  getAgentRuns() {
    return this.prisma.agentRun.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  @Get('stats')
  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      totalJobs,
      emailsSentToday,
      agentRunsToday,
      avgScore,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { preferences: { agentEnabled: true } },
      }),
      this.prisma.job.count(),
      this.prisma.emailLog.count({
        where: { status: 'SENT', sentAt: { gte: today } },
      }),
      this.prisma.agentRun.count({
        where: { startedAt: { gte: today } },
      }),
      this.prisma.jobMatch.aggregate({ _avg: { matchScore: true } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalJobs,
      emailsSentToday,
      agentRunsToday,
      averageMatchScore: Math.round(avgScore._avg.matchScore || 0),
    };
  }
}
