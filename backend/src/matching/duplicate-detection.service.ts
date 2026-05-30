import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DuplicateDetectionService {
  constructor(private prisma: PrismaService) {}

  async isAlreadySent(userId: string, jobUrl: string): Promise<boolean> {
    const existing = await this.prisma.sentJob.findUnique({
      where: { userId_jobUrl: { userId, jobUrl } },
    });
    return !!existing;
  }

  async markAsSent(userId: string, jobId: string, jobUrl: string) {
    await this.prisma.sentJob.upsert({
      where: { userId_jobUrl: { userId, jobUrl } },
      create: { userId, jobId, jobUrl },
      update: { sentAt: new Date() },
    });
  }

  async filterNewJobs<T extends { url: string }>(
    userId: string,
    jobs: T[],
  ): Promise<T[]> {
    const sent = await this.prisma.sentJob.findMany({
      where: { userId },
      select: { jobUrl: true },
    });
    const sentUrls = new Set(sent.map((s) => s.jobUrl));
    return jobs.filter((j) => !sentUrls.has(j.url));
  }
}
