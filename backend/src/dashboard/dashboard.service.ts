import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardStats } from '../common/types';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: string): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      newJobsToday,
      jobsThisWeek,
      avgScore,
      totalMatched,
      emailsSent,
    ] = await Promise.all([
      this.prisma.jobMatch.count({
        where: { userId, matchedAt: { gte: today } },
      }),
      this.prisma.jobMatch.count({
        where: { userId, matchedAt: { gte: weekAgo } },
      }),
      this.prisma.jobMatch.aggregate({
        where: { userId },
        _avg: { matchScore: true },
      }),
      this.prisma.jobMatch.count({ where: { userId } }),
      this.prisma.emailLog.count({
        where: { userId, status: 'SENT' },
      }),
    ]);

    return {
      newJobsToday,
      jobsThisWeek,
      averageMatchScore: Math.round(avgScore._avg.matchScore || 0),
      totalJobsMatched: totalMatched,
      emailsSent,
    };
  }
}
