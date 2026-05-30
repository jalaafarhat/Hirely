import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileAnalyzerService } from '../cv/profile-analyzer.service';
import { JobSourceService } from '../sources/job-source.service';
import { JobMatchingService } from '../matching/job-matching.service';
import { DuplicateDetectionService } from '../matching/duplicate-detection.service';
import { EmailDigestService } from '../email/email-digest.service';
import { AgentRunStatus, WorkMode } from '@prisma/client';
import { NormalizedJob, ParsedProfile } from '../common/types';
import { AgentRunResult } from '../common/types/agent.types';

const MAX_QUERIES = 3;
const MAX_JOBS_TO_MATCH = 20;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private analyzer: ProfileAnalyzerService,
    private jobSources: JobSourceService,
    private matching: JobMatchingService,
    private dedup: DuplicateDetectionService,
    private emailDigest: EmailDigestService,
    @InjectQueue('job-agent') private agentQueue: Queue,
  ) {}

  async runNowForUser(userId: string): Promise<AgentRunResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, preferences: true, cvFile: true },
    });

    if (!user?.cvFile) {
      throw new BadRequestException(
        'Please upload your CV first before running a job search.',
      );
    }
    if (!user.profile) {
      throw new BadRequestException(
        'Your CV is still being analyzed. Please wait a moment and try again.',
      );
    }

    return this.runForUser(userId, {
      sendEmail: user.preferences?.emailDigestEnabled ?? false,
    });
  }

  async enqueueUserRun(userId: string, sendEmail = true) {
    try {
      await this.agentQueue.add(
        'run-for-user',
        { userId, sendEmail },
        { removeOnComplete: true, removeOnFail: 100 },
      );
    } catch (error) {
      this.logger.warn('Queue unavailable, running agent inline', error);
      await this.runForUser(userId, { sendEmail });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledAgent() {
    if (this.running) return;
    this.running = true;

    try {
      const now = new Date();

      const users = await this.prisma.user.findMany({
        where: {
          preferences: { agentEnabled: true, emailDigestEnabled: true },
          profile: { isNot: null },
        },
        include: { profile: true, preferences: true },
      });

      for (const user of users) {
        if (!user.profile || !user.preferences) continue;

        const userHour = this.getUserLocalHour(user.timezone, now);
        const digestHours = user.preferences.digestHours?.length
          ? user.preferences.digestHours
          : [9, 15];

        if (!digestHours.includes(userHour)) continue;

        await this.enqueueUserRun(user.id, true);
      }
    } catch (error) {
      this.logger.error('Agent cron failed', error);
    } finally {
      this.running = false;
    }
  }

  async runForUser(
    userId: string,
    options: { sendEmail: boolean } = { sendEmail: false },
  ): Promise<AgentRunResult> {
    const run = await this.prisma.agentRun.create({
      data: { userId, status: AgentRunStatus.RUNNING },
    });

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, preferences: true },
      });
      if (!user?.profile || !user.preferences) {
        throw new Error('Missing profile or preferences');
      }

      const parsedProfile = this.toParsedProfile(user.profile);
      const baseQueries = (
        await this.analyzer.generateSearchQueries(parsedProfile)
      ).slice(0, MAX_QUERIES);

      const preferRemote = user.preferences.workModes.includes('REMOTE');
      const queries = baseQueries.map((q) =>
        preferRemote && !q.toLowerCase().includes('remote') ? `${q} remote` : q,
      );

      this.logger.log(
        `Agent for ${userId}: searching with queries: ${queries.join(', ')}`,
      );

      const location = this.resolveSearchLocation(user.preferences);

      const allJobs: NormalizedJob[] = [];

      const companyJobs = await this.jobSources.searchCompanyBoards(parsedProfile);
      allJobs.push(...companyJobs);

      for (const query of queries) {
        const jobs = await this.jobSources.searchAll(query, location);
        allJobs.push(...jobs);
      }

      const uniqueJobs = this.deduplicateByUrl(allJobs);
      const newJobs = (
        await this.dedup.filterNewJobs(userId, uniqueJobs)
      ).slice(0, MAX_JOBS_TO_MATCH) as NormalizedJob[];

      const threshold = user.preferences.matchThreshold;
      const matchedForEmail: Array<{
        title: string;
        company: string;
        location: string;
        matchScore: number;
        reasoning: string;
        url: string;
        jobId: string;
      }> = [];

      for (const jobData of newJobs) {
        if (!jobData.url) continue;

        const matchResult = await this.matching.matchJob(
          jobData,
          user.profile,
          user.preferences,
        );

        if (matchResult.matchScore < threshold) continue;

        const job = await this.prisma.job.upsert({
          where: { url: jobData.url },
          create: {
            title: jobData.title || 'Unknown',
            company: jobData.company || 'Unknown',
            location: jobData.location || 'Unknown',
            description: jobData.description || '',
            salary: jobData.salary,
            url: jobData.url,
            source: jobData.source || 'unknown',
            postedDate: jobData.postedDate
              ? new Date(jobData.postedDate)
              : null,
            workMode: this.detectWorkMode(jobData.location),
            externalId: jobData.externalId,
          },
          update: {},
        });

        await this.prisma.jobMatch.upsert({
          where: { userId_jobId: { userId, jobId: job.id } },
          create: {
            userId,
            jobId: job.id,
            matchScore: matchResult.matchScore,
            reasoning: matchResult.reasoning,
          },
          update: {
            matchScore: matchResult.matchScore,
            reasoning: matchResult.reasoning,
          },
        });

        matchedForEmail.push({
          title: job.title,
          company: job.company,
          location: job.location,
          matchScore: matchResult.matchScore,
          reasoning: matchResult.reasoning,
          url: job.url,
          jobId: job.id,
        });
      }

      let jobsEmailed = 0;
      let emailError: string | undefined;
      const shouldEmail =
        options.sendEmail &&
        user.preferences.emailDigestEnabled &&
        matchedForEmail.length > 0;

      if (shouldEmail) {
        const emailResult = await this.emailDigest.sendDailyDigest(
          userId,
          user.email,
          matchedForEmail,
        );
        if (emailResult.sent) {
          jobsEmailed = matchedForEmail.length;
          for (const job of matchedForEmail) {
            await this.dedup.markAsSent(userId, job.jobId, job.url);
          }
        } else {
          emailError =
            emailResult.error ||
            'Email could not be delivered. Restart the backend after updating EMAIL_FROM in backend/.env.';
        }
      }

      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.COMPLETED,
          jobsFound: uniqueJobs.length,
          jobsMatched: matchedForEmail.length,
          jobsSent: jobsEmailed,
          completedAt: new Date(),
        },
      });

      const message = this.buildResultMessage(
        uniqueJobs.length,
        newJobs.length,
        matchedForEmail.length,
        threshold,
        options.sendEmail,
        jobsEmailed,
        emailError,
      );

      this.logger.log(`Agent completed for ${userId}: ${message}`);

      return {
        jobsFound: uniqueJobs.length,
        jobsMatched: matchedForEmail.length,
        jobsEmailed,
        message,
      };
    } catch (error) {
      this.logger.error(`Agent failed for ${userId}`, error);
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.FAILED,
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private buildResultMessage(
    jobsFound: number,
    newJobs: number,
    matched: number,
    threshold: number,
    sendEmail: boolean,
    jobsEmailed = 0,
    emailError?: string,
  ): string {
    if (jobsFound === 0) {
      return 'No jobs found from job boards. Try updating your CV with more skills and job titles.';
    }
    if (newJobs === 0) {
      return 'No new jobs since your last search. Check back later or lower your match threshold.';
    }
    if (matched === 0) {
      return `Found ${jobsFound} jobs but none scored above your ${threshold}% threshold. Try lowering your match threshold in Preferences.`;
    }
    if (sendEmail && jobsEmailed > 0) {
      return `Found ${matched} matching job${matched > 1 ? 's' : ''} and sent them to your email.`;
    }
    if (sendEmail && emailError) {
      return `Found ${matched} matching job${matched > 1 ? 's' : ''}! ${emailError}`;
    }
    if (sendEmail) {
      return `Found ${matched} matching job${matched > 1 ? 's' : ''}. Email digests are enabled but delivery failed — check the Jobs page.`;
    }
    return `Found ${matched} matching job${matched > 1 ? 's' : ''}! View them on the Jobs page. (Enable email digests in Preferences to also receive them by email.)`;
  }

  private resolveSearchLocation(preferences: {
    locationType: string;
    country: string | null;
    city: string | null;
    workModes: string[];
  }): string | undefined {
    if (preferences.workModes.includes('REMOTE')) {
      return undefined;
    }
    if (preferences.locationType === 'COUNTRY' && preferences.country?.trim()) {
      return preferences.country.trim();
    }
    if (preferences.locationType === 'CITY' && preferences.city?.trim()) {
      return preferences.city.trim();
    }
    return undefined;
  }

  private getUserLocalHour(timezone: string, date: Date): number {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(formatter.format(date), 10);
    } catch {
      return date.getUTCHours();
    }
  }

  private deduplicateByUrl(jobs: NormalizedJob[]): NormalizedJob[] {
    const seen = new Set<string>();
    return jobs.filter((j) => {
      if (!j.url || seen.has(j.url)) return false;
      seen.add(j.url);
      return true;
    });
  }

  private toParsedProfile(profile: {
    name: string | null;
    email: string | null;
    phone: string | null;
    summary: string | null;
    jobTitles: string[];
    skills: string[];
    technologies: string[];
    yearsExperience: number;
    education: unknown;
    certifications: string[];
    industries: string[];
    languages: string[];
    locations: string[];
    seniority: string | null;
  }): ParsedProfile {
    return {
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      summary: profile.summary || '',
      jobTitles: profile.jobTitles,
      skills: profile.skills,
      technologies: profile.technologies,
      yearsExperience: profile.yearsExperience,
      education: (profile.education as ParsedProfile['education']) || [],
      certifications: profile.certifications,
      industries: profile.industries,
      languages: profile.languages,
      locations: profile.locations,
      seniority: profile.seniority || '',
    };
  }

  private detectWorkMode(location: string): WorkMode | null {
    const lower = location.toLowerCase();
    if (lower.includes('remote')) return WorkMode.REMOTE;
    if (lower.includes('hybrid')) return WorkMode.HYBRID;
    return WorkMode.ONSITE;
  }
}
