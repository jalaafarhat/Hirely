import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedbackType } from '@prisma/client';

@Injectable()
export class RecommendationLearningService {
  private readonly logger = new Logger(RecommendationLearningService.name);

  constructor(private prisma: PrismaService) {}

  async recordFeedback(
    userId: string,
    jobId: string,
    type: FeedbackType,
  ) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;

    const keywords = this.extractKeywords(job.title, job.description);

    await this.prisma.userFeedback.create({
      data: { userId, jobId, type, keywords },
    });

    const prefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    if (!prefs) return;

    const liked = new Set(prefs.likedKeywords);
    const disliked = new Set(prefs.dislikedKeywords);

    if (type === FeedbackType.INTERESTED) {
      keywords.forEach((k) => {
        liked.add(k);
        disliked.delete(k);
      });
    } else {
      keywords.forEach((k) => {
        disliked.add(k);
        liked.delete(k);
      });
    }

    await this.prisma.userPreferences.update({
      where: { userId },
      data: {
        likedKeywords: Array.from(liked).slice(-50),
        dislikedKeywords: Array.from(disliked).slice(-50),
      },
    });

    this.logger.log(`Updated learning for user ${userId}: ${type}`);
  }

  private extractKeywords(title: string, description: string): string[] {
    const text = `${title} ${description}`.toLowerCase();
    const techKeywords = [
      'angular', 'react', 'vue', 'typescript', 'javascript', 'node',
      'python', 'java', 'go', 'rust', 'php', 'wordpress', 'aws', 'docker',
      'kubernetes', 'sql', 'mongodb', 'graphql', 'nestjs', 'spring',
    ];
    return techKeywords.filter((k) => text.includes(k));
  }
}
