import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { JobSourceProvider } from './job-source.interface';

import { NormalizedJob, ParsedProfile } from '../common/types';
import { JobSearchOptions } from '../common/types/search.types';
import { CompanyCareersProvider } from './company-careers.provider';



@Injectable()

export class SerpApiJobProvider implements JobSourceProvider {

  readonly name = 'serpapi';

  private readonly logger = new Logger(SerpApiJobProvider.name);



  constructor(private config: ConfigService) {}



  async search(query: string, location?: string): Promise<NormalizedJob[]> {

    const apiKey = this.config.get<string>('SERPAPI_API_KEY');

    if (!apiKey) {

      this.logger.warn('No SERPAPI_API_KEY configured');

      return [];

    }



    const attempts: Array<string | undefined> = [];

    if (location?.trim()) {

      attempts.push(location.trim());

    }

    attempts.push(undefined);

    if (location?.trim()) {

      attempts.push('United States');

    }



    const tried = new Set<string>();

    for (const loc of attempts) {

      const key = loc || '__global__';

      if (tried.has(key)) continue;

      tried.add(key);



      const results = await this.fetchJobs(apiKey, query, loc);

      if (results.length > 0) {

        if (loc !== location) {

          this.logger.log(

            `SerpAPI "${query}"${loc ? ` (fallback: ${loc})` : ''}: ${results.length} jobs`,

          );

        } else {

          this.logger.log(`SerpAPI "${query}": ${results.length} jobs`);

        }

        return results;

      }

    }



    this.logger.warn(`SerpAPI "${query}": no jobs after ${tried.size} attempt(s)`);

    return [];

  }



  private async fetchJobs(

    apiKey: string,

    query: string,

    location?: string,

  ): Promise<NormalizedJob[]> {

    try {

      const params = new URLSearchParams({

        engine: 'google_jobs',

        q: query,

        api_key: apiKey,

      });

      if (location) params.set('location', location);



      const response = await fetch(

        `https://serpapi.com/search.json?${params.toString()}`,

      );

      if (!response.ok) {

        const body = await response.text();

        this.logger.error(

          `SerpAPI HTTP ${response.status} for "${query}": ${body.slice(0, 200)}`,

        );

        return [];

      }



      const data = (await response.json()) as {

        error?: string;

        jobs_results?: Array<{

          title?: string;

          company_name?: string;

          location?: string;

          description?: string;

          detected_extensions?: { salary?: string };

          apply_options?: Array<{ link?: string }>;

          share_link?: string;

          job_id?: string;

          via?: string;

        }>;

      };



      const rawJobs = data.jobs_results || [];

      if (rawJobs.length === 0 && data.error) {

        this.logger.debug(`SerpAPI "${query}"${location ? ` @ ${location}` : ''}: ${data.error}`);

        return [];

      }



      return rawJobs

        .map((job) => {

          const url =

            job.apply_options?.[0]?.link ||

            job.share_link ||

            (job.job_id

              ? `https://www.google.com/search?ibp=htl;jobs&q=${encodeURIComponent((job.title || '') + ' ' + (job.company_name || ''))}`

              : '');



          return {

            title: job.title || 'Unknown',

            company: job.company_name || 'Unknown',

            location: job.location || 'Unknown',

            description: job.description || job.title || '',

            salary: job.detected_extensions?.salary || '',

            url,

            source: this.detectSource(job.via || ''),

            postedDate: new Date().toISOString().split('T')[0],

            externalId: job.job_id,

          };

        })

        .filter((j) => j.url);

    } catch (error) {

      this.logger.error(`SerpAPI search failed for "${query}"`, error);

      return [];

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

    return createFilteredProvider(this.serp, 'linkedin').search(query, location);

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

    return createFilteredProvider(this.serp, 'glassdoor').search(query, location);

  }

}



@Injectable()

export class GreenhouseProvider implements JobSourceProvider {

  readonly name = 'greenhouse';

  constructor(private serp: SerpApiJobProvider) {}

  search(query: string, location?: string) {

    return createFilteredProvider(this.serp, 'greenhouse').search(query, location);

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

    return createFilteredProvider(this.serp, 'wellfound').search(query, location);

  }

}



@Injectable()

export class JobSourceService {

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



  async searchAll(query: string, location?: string): Promise<NormalizedJob[]> {

    const results = await this.serpApi.search(query, location);

    const seen = new Set<string>();

    return results.filter((job) => {

      if (seen.has(job.url)) return false;

      seen.add(job.url);

      return true;

    });

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

