import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { EmailStatus } from '@prisma/client';

interface DigestJob {
  title: string;
  company: string;
  location: string;
  matchScore: number;
  reasoning: string;
  url: string;
}

@Injectable()
export class EmailDigestService {
  private readonly logger = new Logger(EmailDigestService.name);

  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
  ) {}

  async sendDailyDigest(
    userId: string,
    email: string,
    jobs: DigestJob[],
  ): Promise<{ sent: boolean; error?: string }> {
    if (jobs.length === 0) return { sent: true };

    const subject = 'Hirely - New Jobs Matching Your Profile';
    const html = this.buildDigestHtml(jobs);

    const log = await this.prisma.emailLog.create({
      data: {
        userId,
        subject,
        jobCount: jobs.length,
        status: EmailStatus.PENDING,
      },
    });

    const result = await this.notification.sendEmailDetailed(email, subject, html);

    await this.prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: result.sent ? EmailStatus.SENT : EmailStatus.FAILED,
        sentAt: result.sent ? new Date() : null,
        error: result.sent ? null : result.error || 'Failed to send email',
      },
    });

    if (!result.sent) {
      this.logger.warn(`Digest email failed for ${email}: ${result.error}`);
    }

    return { sent: result.sent, error: result.error };
  }

  private buildDigestHtml(jobs: DigestJob[]): string {
    const jobBlocks = jobs
      .map(
        (job) => `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px;color:#111827;">${job.title}</h3>
        <p style="margin:4px 0;color:#6b7280;"><strong>Company:</strong> ${job.company}</p>
        <p style="margin:4px 0;color:#6b7280;"><strong>Location:</strong> ${job.location}</p>
        <p style="margin:4px 0;color:#059669;"><strong>Match:</strong> ${job.matchScore}%</p>
        <p style="margin:8px 0;color:#374151;"><strong>Why:</strong> ${job.reasoning}</p>
        <a href="${job.url}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;">Apply Now</a>
      </div>`,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h1 style="color:#4f46e5;">Hirely</h1>
        <p>Here are ${jobs.length} new job${jobs.length > 1 ? 's' : ''} matching your profile:</p>
        ${jobBlocks}
        <p style="color:#9ca3af;font-size:12px;margin-top:32px;">You're receiving this because you enabled job alerts on Hirely.</p>
      </body>
      </html>`;
  }
}
