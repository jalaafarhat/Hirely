import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceProvider } from './job-source.interface';
import { NormalizedJob, ParsedProfile } from '../common/types';
import { JobSearchOptions } from '../common/types/search.types';
import { CompanyCareersProvider } from './company-careers.provider';

const MAX_GOOGLE_JOBS_PAGES = 2;
const MAX_ORGANIC_RESULTS = 20;

type SerpJobRaw = {
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  detected_extensions?: { salary?: string };
  apply_options?: Array<{ link?: string }>;
  share_link?: string;
  job_id?: string;
  via?: string;
};

type OrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

/** Parse "Software Engineer - Google | LinkedIn" style titles */
export function parseLinkedInOrganicTitle(raw: string): {
  title: string;
  company: string;
} {
  const cleaned = raw.replace(/\s*\|\s*LinkedIn\s*$/i, '').trim();
  const dashIdx = cleaned.lastIndexOf(' - ');
  if (dashIdx > 0) {
    return {
      title: cleaned.slice(0, dashIdx).trim(),
      company: cleaned.slice(dashIdx + 3).trim(),
    };
  }
  return { title: cleaned || 'Unknown', company: 'Unknown' };
}

@Injectable()
export class SerpApiJobProvider implements JobSourceProvider {
  readonly name = 'serpapi';
  private readonly logger = new Logger(SerpApiJobProvider.name);
  private lastError: string | null = null;

  constructor(private config: ConfigService) {}

  getLastError(): string | null {
    return this.lastError;
  }

  async search(query: string, location?: string): Promise<NormalizedJob[]> {
    return this.searchGoogleJobs(query, location);
  }

  /** Google Jobs via SerpAPI with optional site: filter */
  async searchSite(
    siteFilter: string,
    query: string,
    location?: string,
  ): Promise<NormalizedJob[]> {
    const siteQuery = `${query} site:${siteFilter}`;
    const source = siteFilter.includes('linkedin')
      ? 'linkedin'
      : siteFilter.includes('indeed')
        ? 'indeed'
        : siteFilter.includes('glassdoor')
          ? 'glassdoor'
          : 'google_jobs';
    return this.searchGoogleJobs(siteQuery, location, source);
  }

  /**
   * LinkedIn/Indeed listings via Google organic search (works when google_jobs
   * site: filters return nothing).
   */
  async searchOrganicSite(
    siteFilter: string,
    query: string,
    location?: string,
    source = 'linkedin',
  ): Promise<NormalizedJob[]> {
    const apiKey = this.config.get<string>('SERPAPI_API_KEY');
    if (!apiKey) {
      this.logger.warn('No SERPAPI_API_KEY configured');
      return [];
    }

    const attempts: Array<string | undefined> = [];
    if (location?.trim()) attempts.push(location.trim());
    attempts.push(undefined);

    const seen = new Set<string>();
    const jobs: NormalizedJob[] = [];

    for (const loc of attempts) {
      const batch = await this.fetchOrganicPage(
        apiKey,
        `${query} site:${siteFilter}`,
        loc,
        source,
      );
      for (const job of batch) {
        if (!seen.has(job.url)) {
          seen.add(job.url);
          jobs.push(job);
        }
      }
    }

    if (jobs.length > 0) {
      this.logger.log(
        `SerpAPI organic ${source} "${query}": ${jobs.length} jobs`,
      );
    }

    return jobs;
  }

  private async searchGoogleJobs(
    query: string,
    location?: string,
    forceSource?: string,
  ): Promise<NormalizedJob[]> {
    const apiKey = this.config.get<string>('SERPAPI_API_KEY');
    if (!apiKey) {
      this.logger.warn('No SERPAPI_API_KEY configured');
      return [];
    }

    const attempts: Array<string | undefined> = [];
    if (location?.trim()) attempts.push(location.trim());
    attempts.push(undefined);
    if (location?.trim()) attempts.push('United States');

    const seen = new Set<string>();
    const merged: NormalizedJob[] = [];

    for (const loc of attempts) {
      const results = await this.fetchAllPages(apiKey, query, loc, forceSource);
      for (const job of results) {
        if (!job.url || seen.has(job.url)) continue;
        seen.add(job.url);
        merged.push(job);
      }
    }

    if (merged.length > 0) {
      this.logger.log(`SerpAPI google_jobs "${query}": ${merged.length} jobs`);
    } else {
      this.logger.warn(`SerpAPI google_jobs "${query}": no jobs found`);
    }

    return merged;
  }

  private async fetchAllPages(
    apiKey: string,
    query: string,
    location?: string,
    forceSource?: string,
  ): Promise<NormalizedJob[]> {
    const allJobs: NormalizedJob[] = [];
    let nextToken: string | undefined;

    for (let page = 0; page < MAX_GOOGLE_JOBS_PAGES; page++) {
      const { jobs, nextPageToken } = await this.fetchJobsPage(
        apiKey,
        query,
        location,
        nextToken,
        forceSource,
      );
      allJobs.push(...jobs);
      if (!nextPageToken || jobs.length === 0) break;
      nextToken = nextPageToken;
    }

    return allJobs;
  }

  private async fetchJobsPage(
    apiKey: string,
    query: string,
    location?: string,
    nextPageToken?: string,
    forceSource?: string,
  ): Promise<{ jobs: NormalizedJob[]; nextPageToken?: string }> {
    try {
      const params = new URLSearchParams({
        engine: 'google_jobs',
        q: query,
        api_key: apiKey,
      });
      if (location) params.set('location', location);
      if (nextPageToken) params.set('next_page_token', nextPageToken);

      const response = await fetch(
        `https://serpapi.com/search.json?${params.toString()}`,
      );

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(
          `SerpAPI HTTP ${response.status} for "${query}": ${body.slice(0, 200)}`,
        );
        return { jobs: [] };
      }

      const data = (await response.json()) as {
        error?: string;
        jobs_results?: SerpJobRaw[];
        serpapi_pagination?: { next_page_token?: string };
      };

      this.recordSerpError(data.error);

      const rawJobs = data.jobs_results || [];
      const jobs = rawJobs
        .map((job) => this.mapJob(job, forceSource))
        .filter((j) => j.url);

      return {
        jobs,
        nextPageToken: data.serpapi_pagination?.next_page_token,
      };
    } catch (error) {
      this.logger.error(`SerpAPI search failed for "${query}"`, error);
      return { jobs: [] };
    }
  }

  private async fetchOrganicPage(
    apiKey: string,
    query: string,
    location: string | undefined,
    source: string,
  ): Promise<NormalizedJob[]> {
    try {
      const params = new URLSearchParams({
        engine: 'google',
        q: query,
        api_key: apiKey,
        num: String(MAX_ORGANIC_RESULTS),
      });
      if (location) params.set('location', location);

      const response = await fetch(
        `https://serpapi.com/search.json?${params.toString()}`,
      );

      if (!response.ok) return [];

      const data = (await response.json()) as {
        error?: string;
        organic_results?: OrganicResult[];
      };

      this.recordSerpError(data.error);

      return (data.organic_results || [])
        .filter((r) => r.link?.includes('linkedin.com/jobs'))
        .map((r) => this.mapOrganicResult(r, source))
        .filter((j) => j.url);
    } catch (error) {
      this.logger.error(`SerpAPI organic search failed for "${query}"`, error);
      return [];
    }
  }

  private mapOrganicResult(
    result: OrganicResult,
    source: string,
  ): NormalizedJob {
    const { title, company } = parseLinkedInOrganicTitle(result.title || '');
    return {
      title,
      company,
      location: 'See listing',
      description: result.snippet || title,
      salary: '',
      url: result.link || '',
      source,
      postedDate: new Date().toISOString().split('T')[0],
    };
  }

  private mapJob(job: SerpJobRaw, forceSource?: string): NormalizedJob {
    const applyLinks =
      job.apply_options?.map((o) => o.link).filter(Boolean) || [];
    const linkedInUrl = applyLinks.find((u) =>
      u?.includes('linkedin.com/jobs'),
    );
    const url =
      linkedInUrl ||
      applyLinks[0] ||
      job.share_link ||
      (job.job_id
        ? `https://www.google.com/search?ibp=htl;jobs&q=${encodeURIComponent((job.title || '') + ' ' + (job.company_name || ''))}`
        : '');

    const via = job.via || '';
    const source =
      forceSource ||
      (linkedInUrl || via.toLowerCase().includes('linkedin')
        ? 'linkedin'
        : this.detectSource(via));

    return {
      title: job.title || 'Unknown',
      company: job.company_name || 'Unknown',
      location: job.location || 'Unknown',
      description: job.description || job.title || '',
      salary: job.detected_extensions?.salary || '',
      url,
      source,
      postedDate: new Date().toISOString().split('T')[0],
      externalId: job.job_id,
    };
  }

  private recordSerpError(error?: string): void {
    if (!error) return;
    this.lastError = error;
    if (/run out of searches|quota|credit/i.test(error)) {
      this.logger.error(
        `SerpAPI quota issue: ${error}. Add credits at https://serpapi.com/manage-api-key`,
      );
    } else {
      this.logger.warn(`SerpAPI: ${error}`);
    }
  }

  private detectSource(via: string): string {
    const lower = via.toLowerCase();
    if (lower.includes('linkedin')) return 'linkedin';
    if (lower.includes('indeed')) return 'indeed';
    if (lower.includes('glassdoor')) return 'glassdoor';
    if (lower.includes('greenhouse')) return 'greenhouse';
    if (lower.includes('lever')) return 'lever';
    if (lower.includes('ashby')) return 'ashby';
    if (lower.includes('wellfound') || lower.includes('angelist'))
      return 'wellfound';
    return 'google_jobs';
  }
}

function createFilteredProvider(
  base: SerpApiJobProvider,
  sourceName: string,
): JobSourceProvider {
  return {
    name: sourceName,
    search: async (query, location) => {
      const jobs = await base.search(query, location);
      return jobs.filter((j) => j.source === sourceName);
    },
  };
}

@Injectable()
export class LinkedInProvider implements JobSourceProvider {
  readonly name = 'linkedin';
  constructor(private serp: SerpApiJobProvider) {}
  search(query: string, location?: string) {
    return createFilteredProvider(this.serp, 'linkedin').search(
      query,
      location,
    );
  }
}

@Injectable()
export class IndeedProvider implements JobSourceProvider {
  readonly name = 'indeed';
  constructor(private serp: SerpApiJobProvider) {}
  search(query: string, location?: string) {
    return createFilteredProvider(this.serp, 'indeed').search(query, location);
  }
}

@Injectable()
export class GlassdoorProvider implements JobSourceProvider {
  readonly name = 'glassdoor';
  constructor(private serp: SerpApiJobProvider) {}
  search(query: string, location?: string) {
    return createFilteredProvider(this.serp, 'glassdoor').search(
      query,
      location,
    );
  }
}

@Injectable()
export class GreenhouseProvider implements JobSourceProvider {
  readonly name = 'greenhouse';
  constructor(private serp: SerpApiJobProvider) {}
  search(query: string, location?: string) {
    return createFilteredProvider(this.serp, 'greenhouse').search(
      query,
      location,
    );
  }
}

@Injectable()
export class LeverProvider implements JobSourceProvider {
  readonly name = 'lever';
  constructor(private serp: SerpApiJobProvider) {}
  search(query: string, location?: string) {
    return createFilteredProvider(this.serp, 'lever').search(query, location);
  }
}

@Injectable()
export class AshbyProvider implements JobSourceProvider {
  readonly name = 'ashby';
  constructor(private serp: SerpApiJobProvider) {}
  search(query: string, location?: string) {
    return createFilteredProvider(this.serp, 'ashby').search(query, location);
  }
}

@Injectable()
export class WellfoundProvider implements JobSourceProvider {
  readonly name = 'wellfound';
  constructor(private serp: SerpApiJobProvider) {}
  search(query: string, location?: string) {
    return createFilteredProvider(this.serp, 'wellfound').search(
      query,
      location,
    );
  }
}

@Injectable()
export class JobSourceService {
  private readonly logger = new Logger(JobSourceService.name);

  constructor(
    private serpApi: SerpApiJobProvider,
    private linkedin: LinkedInProvider,
    private indeed: IndeedProvider,
    private glassdoor: GlassdoorProvider,
    private greenhouse: GreenhouseProvider,
    private lever: LeverProvider,
    private ashby: AshbyProvider,
    private wellfound: WellfoundProvider,
    private companyCareers: CompanyCareersProvider,
  ) {}

  getSerpApiError(): string | null {
    return this.serpApi.getLastError();
  }

  getProviders(): JobSourceProvider[] {
    return [
      this.serpApi,
      this.linkedin,
      this.indeed,
      this.glassdoor,
      this.greenhouse,
      this.lever,
      this.ashby,
      this.wellfound,
    ];
  }

  /** Google Jobs + LinkedIn organic + site searches in parallel */
  async searchAll(query: string, location?: string): Promise<NormalizedJob[]> {
    const batches = await Promise.allSettled([
      this.serpApi.search(query, location),
      this.serpApi.searchOrganicSite('linkedin.com/jobs/view', query, location),
      this.serpApi.searchOrganicSite('linkedin.com/jobs', query, location),
      this.serpApi.searchSite('linkedin.com/jobs', query, location),
      this.serpApi.searchSite('indeed.com', query, location),
      this.serpApi.searchSite('glassdoor.com/job', query, location),
    ]);

    const seen = new Set<string>();
    const jobs: NormalizedJob[] = [];
    let linkedInCount = 0;

    for (const batch of batches) {
      if (batch.status !== 'fulfilled') {
        this.logger.warn('Job source batch failed', batch.reason);
        continue;
      }
      for (const job of batch.value) {
        if (!job.url || seen.has(job.url)) continue;
        seen.add(job.url);
        jobs.push(job);
        if (job.source === 'linkedin') linkedInCount++;
      }
    }

    this.logger.log(
      `searchAll "${query}": ${jobs.length} unique (${linkedInCount} LinkedIn)`,
    );
    return jobs;
  }

  async searchCompanyBoards(
    profile: ParsedProfile,
    options: JobSearchOptions = {},
  ): Promise<NormalizedJob[]> {
    const queries = new Set<string>();

    for (const title of profile.jobTitles.slice(0, 3)) {
      queries.add(title);
      if (profile.yearsExperience <= 2) {
        queries.add(`Junior ${title}`);
      } else if (profile.yearsExperience >= 5) {
        queries.add(`Senior ${title}`);
      }
    }

    for (const tech of profile.technologies.slice(0, 3)) {
      queries.add(`${tech} Engineer`);
    }

    if (profile.seniority) {
      queries.add(`${profile.seniority} Software Engineer`);
    }

    if (queries.size === 0) {
      queries.add('Software Engineer');
    }

    return this.companyCareers.search(Array.from(queries), options);
  }
}
