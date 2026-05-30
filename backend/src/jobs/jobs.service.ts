import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobMatchStatus, FeedbackType, WorkMode } from '@prisma/client';
import { RecommendationLearningService } from '../feedback/recommendation-learning.service';

interface JobQuery {
  page?: number;
  limit?: number;
  minScore?: number;
  source?: string;
  workMode?: string;
  company?: string;
  sort?: string;
  status?: JobMatchStatus;
  savedOnly?: boolean;
}

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private learning: RecommendationLearningService,
  ) {}

  async listJobs(userId: string, query: JobQuery) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (query.minScore) where.matchScore = { gte: query.minScore };
    if (query.status) where.status = query.status;
    if (query.savedOnly) where.status = JobMatchStatus.SAVED;

    const jobWhere: Record<string, unknown> = {};
    if (query.source) jobWhere.source = query.source;
    if (query.company) jobWhere.company = { contains: query.company, mode: 'insensitive' };
    if (query.workMode) jobWhere.workMode = query.workMode.toUpperCase() as WorkMode;

    if (Object.keys(jobWhere).length) where.job = jobWhere;

    const orderBy =
      query.sort === 'date'
        ? { matchedAt: 'desc' as const }
        : { matchScore: 'desc' as const };

    const [matches, total] = await Promise.all([
      this.prisma.jobMatch.findMany({
        where,
        include: { job: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.jobMatch.count({ where }),
    ]);

    return {
      data: matches.map((m) => ({
        id: m.id,
        jobId: m.jobId,
        title: m.job.title,
        company: m.job.company,
        location: m.job.location,
        salary: m.job.salary,
        url: m.job.url,
        source: m.job.source,
        postedDate: m.job.postedDate,
        workMode: m.job.workMode,
        matchScore: m.matchScore,
        reasoning: m.reasoning,
        status: m.status,
        matchedAt: m.matchedAt,
      })),
      meta: { total, page, limit },
    };
  }

  async saveJob(userId: string, matchId: string) {
    const match = await this.findMatch(userId, matchId);
    await this.prisma.jobMatch.update({
      where: { id: matchId },
      data: { status: JobMatchStatus.SAVED },
    });
    await this.prisma.savedJob.upsert({
      where: { userId_jobId: { userId, jobId: match.jobId } },
      create: { userId, jobId: match.jobId },
      update: {},
    });
    return { message: 'Job saved' };
  }

  async unsaveJob(userId: string, matchId: string) {
    const match = await this.findMatch(userId, matchId);
    await this.prisma.jobMatch.update({
      where: { id: matchId },
      data: { status: JobMatchStatus.NEW },
    });
    await this.prisma.savedJob.deleteMany({
      where: { userId, jobId: match.jobId },
    });
    return { message: 'Job unsaved' };
  }

  async hideJob(userId: string, matchId: string) {
    await this.findMatch(userId, matchId);
    await this.prisma.jobMatch.update({
      where: { id: matchId },
      data: { status: JobMatchStatus.HIDDEN },
    });
    return { message: 'Job hidden' };
  }

  async markApplied(userId: string, matchId: string) {
    const match = await this.findMatch(userId, matchId);
    await this.prisma.jobMatch.update({
      where: { id: matchId },
      data: { status: JobMatchStatus.APPLIED },
    });
    await this.prisma.application.upsert({
      where: { userId_jobId: { userId, jobId: match.jobId } },
      create: { userId, jobId: match.jobId },
      update: {},
    });
    return { message: 'Marked as applied' };
  }

  async submitFeedback(
    userId: string,
    matchId: string,
    type: FeedbackType,
  ) {
    const match = await this.findMatch(userId, matchId);
    await this.learning.recordFeedback(userId, match.jobId, type);
    return { message: 'Feedback recorded' };
  }

  private async findMatch(userId: string, matchId: string) {
    const match = await this.prisma.jobMatch.findFirst({
      where: { id: matchId, userId },
    });
    if (!match) throw new NotFoundException('Job match not found');
    return match;
  }
}
