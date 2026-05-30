import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NormalizedJob } from '../common/types';
import {
  CompanyBoardConfig,
  TARGET_COMPANY_BOARDS,
} from './company-boards.config';

const USER_AGENT = 'Hirely/1.0 (+https://hirelycareeragent.com)';
const MAX_PER_COMPANY = 15;

@Injectable()
export class CompanyCareersProvider {
  private readonly logger = new Logger(CompanyCareersProvider.name);

  constructor(private config: ConfigService) {}

  async search(query: string): Promise<NormalizedJob[]> {
    const normalizedQuery = query.trim() || 'software engineer';
    this.logger.log(
      `Searching ${TARGET_COMPANY_BOARDS.length} company career sites for "${normalizedQuery}"`,
    );

    const batches = await Promise.allSettled(
      TARGET_COMPANY_BOARDS.map((board) =>
        this.searchBoard(board, normalizedQuery),
      ),
    );

    const seen = new Set<string>();
    const jobs: NormalizedJob[] = [];

    for (const batch of batches) {
      if (batch.status !== 'fulfilled') {
        this.logger.warn('Company board search failed', batch.reason);
        continue;
      }
      for (const job of batch.value) {
        if (!job.url || seen.has(job.url)) continue;
        seen.add(job.url);
        jobs.push(job);
      }
    }

    this.logger.log(`Company career sites: ${jobs.length} jobs total`);
    return jobs;
  }

  private async searchBoard(
    board: CompanyBoardConfig,
    query: string,
  ): Promise<NormalizedJob[]> {
    try {
      switch (board.type) {
        case 'amazon':
          return this.searchAmazon(query);
        case 'eightfold':
          return this.searchEightfold(board, query);
        case 'workday':
          return this.searchWorkday(board, query);
        case 'greenhouse':
          return this.searchGreenhouse(board, query);
        case 'paloalto':
          return this.searchPaloAlto(query);
        case 'serp-site':
          return this.searchViaSerpSite(board, query);
        default:
          return [];
      }
    } catch (error) {
      this.logger.warn(`${board.name} search failed`, error);
      return [];
    }
  }

  private async searchAmazon(query: string): Promise<NormalizedJob[]> {
    const params = new URLSearchParams({
      base_query: query,
      offset: '0',
      result_limit: String(MAX_PER_COMPANY),
    });

    const response = await fetch(
      `https://www.amazon.jobs/en/search.json?${params}`,
      { headers: { 'User-Agent': USER_AGENT } },
    );
    if (!response.ok) return [];

    const data = (await response.json()) as {
      jobs?: Array<{
        title?: string;
        location?: string;
        description?: string;
        description_short?: string;
        job_path?: string;
        posted_date?: string;
        id_icims?: string;
      }>;
    };

    return (data.jobs || [])
      .map((job) => ({
        title: job.title || 'Unknown',
        company: 'Amazon',
        location: job.location || 'Unknown',
        description: this.stripHtml(
          job.description || job.description_short || job.title || '',
        ),
        salary: '',
        url: job.job_path ? `https://www.amazon.jobs${job.job_path}` : '',
        source: 'amazon',
        postedDate: job.posted_date || new Date().toISOString().split('T')[0],
        externalId: job.id_icims,
      }))
      .filter((j) => j.url);
  }

  private async searchEightfold(
    board: CompanyBoardConfig,
    query: string,
  ): Promise<NormalizedJob[]> {
    if (!board.eightfoldHost || !board.domain || !board.careerBase) return [];

    const params = new URLSearchParams({
      domain: board.domain,
      query,
      location: '',
      start: '0',
      sort_by: 'relevance',
    });

    const response = await fetch(
      `https://${board.eightfoldHost}.eightfold.ai/api/pcsx/search?${params}`,
      { headers: { 'User-Agent': USER_AGENT } },
    );
    if (!response.ok) return [];

    const data = (await response.json()) as {
      data?: {
        positions?: Array<{
          id?: number;
          displayJobId?: string;
          name?: string;
          locations?: string[];
          positionUrl?: string;
          department?: string;
        }>;
      };
    };

    return (data.data?.positions || [])
      .slice(0, MAX_PER_COMPANY)
      .map((job) => ({
        title: job.name || 'Unknown',
        company: board.name,
        location: job.locations?.[0] || 'Unknown',
        description: [job.name, job.department, board.name]
          .filter(Boolean)
          .join(' · '),
        salary: '',
        url: job.positionUrl
          ? `${board.careerBase}${job.positionUrl}`
          : job.displayJobId
            ? `${board.careerBase}/us/en/job/${job.displayJobId}`
            : '',
        source: board.source,
        postedDate: new Date().toISOString().split('T')[0],
        externalId: job.displayJobId || String(job.id || ''),
      }))
      .filter((j) => j.url);
  }

  private async searchWorkday(
    board: CompanyBoardConfig,
    query: string,
  ): Promise<NormalizedJob[]> {
    if (!board.workdayHost || !board.workdaySite) return [];

    const tenant = board.workdayHost.split('.')[0];
    const response = await fetch(
      `https://${board.workdayHost}/wday/cxs/${tenant}/${board.workdaySite}/jobs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: MAX_PER_COMPANY,
          offset: 0,
          searchText: query,
        }),
      },
    );
    if (!response.ok) return [];

    const data = (await response.json()) as {
      jobPostings?: Array<{
        title?: string;
        externalPath?: string;
        locationsText?: string;
        bulletFields?: string[];
      }>;
    };

    const base = `https://${board.workdayHost}/en-US/${board.workdaySite}`;
    return (data.jobPostings || [])
      .map((job) => ({
        title: job.title || 'Unknown',
        company: board.name,
        location: job.locationsText || 'Unknown',
        description: job.title || '',
        salary: '',
        url: job.externalPath ? `${base}${job.externalPath}` : '',
        source: board.source,
        postedDate: new Date().toISOString().split('T')[0],
        externalId: job.bulletFields?.[0],
      }))
      .filter((j) => j.url);
  }

  private async searchGreenhouse(
    board: CompanyBoardConfig,
    query: string,
  ): Promise<NormalizedJob[]> {
    if (!board.boardToken) return [];

    const response = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${board.boardToken}/jobs?content=true`,
      { headers: { 'User-Agent': USER_AGENT } },
    );
    if (!response.ok) return [];

    const data = (await response.json()) as {
      jobs?: Array<{
        id: number;
        title: string;
        absolute_url: string;
        location?: { name?: string };
        content?: string;
        updated_at?: string;
      }>;
    };

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (data.jobs || [])
      .filter((job) => this.matchesQuery(job.title, terms))
      .slice(0, MAX_PER_COMPANY)
      .map((job) => ({
        title: job.title,
        company: board.name,
        location: job.location?.name || 'Unknown',
        description: this.stripHtml(job.content || job.title),
        salary: '',
        url: job.absolute_url,
        source: board.source,
        postedDate:
          job.updated_at?.split('T')[0] ||
          new Date().toISOString().split('T')[0],
        externalId: String(job.id),
      }));
  }

  private async searchPaloAlto(query: string): Promise<NormalizedJob[]> {
    const params = new URLSearchParams({
      ActiveFacetID: '0',
      CurrentPage: '1',
      RecordsPerPage: String(MAX_PER_COMPANY),
      SearchKeyword: query,
      SearchResultsModuleName: 'Search Results',
      SortCols: '0',
      SortDirs: '0',
      TotalPages: '1',
      TotalResults: '1',
    });

    const response = await fetch(
      `https://jobs.paloaltonetworks.com/en/search-jobs/results?${params}`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      },
    );
    if (!response.ok) return [];

    const data = (await response.json()) as { results?: string };
    const html = data.results || '';
    const jobs: NormalizedJob[] = [];
    const titledPattern =
      /href=\"(\/en\/job\/[^\"]+)\"[^>]*class=\"[^\"]*job-title-link[^\"]*\"[^>]*>([^<]+)</g;

    for (const match of html.matchAll(titledPattern)) {
      const path = match[1];
      const title = match[2].trim() || this.titleFromPath(path);
      jobs.push({
        title,
        company: 'Palo Alto Networks',
        location: this.locationFromPaloPath(path),
        description: title,
        salary: '',
        url: `https://jobs.paloaltonetworks.com${path}`,
        source: 'paloalto',
        postedDate: new Date().toISOString().split('T')[0],
      });
    }

    if (jobs.length > 0) return jobs;

    for (const match of html.matchAll(/href=\"(\/en\/job\/[^\"]+)\"/g)) {
      const path = match[1];
      jobs.push({
        title: this.titleFromPath(path),
        company: 'Palo Alto Networks',
        location: this.locationFromPaloPath(path),
        description: this.titleFromPath(path),
        salary: '',
        url: `https://jobs.paloaltonetworks.com${path}`,
        source: 'paloalto',
        postedDate: new Date().toISOString().split('T')[0],
      });
      if (jobs.length >= MAX_PER_COMPANY) break;
    }

    return jobs;
  }

  private async searchViaSerpSite(
    board: CompanyBoardConfig,
    query: string,
  ): Promise<NormalizedJob[]> {
    if (!board.siteFilter) return [];

    const apiKey = this.config.get<string>('SERPAPI_API_KEY');
    if (!apiKey) return [];

    const siteQuery = `${query} site:${board.siteFilter}`;
    const params = new URLSearchParams({
      engine: 'google_jobs',
      q: siteQuery,
      api_key: apiKey,
    });

    try {
      const response = await fetch(
        `https://serpapi.com/search.json?${params.toString()}`,
        { headers: { 'User-Agent': USER_AGENT } },
      );
      if (!response.ok) return [];

      const data = (await response.json()) as {
        jobs_results?: Array<{
          title?: string;
          company_name?: string;
          location?: string;
          description?: string;
          apply_options?: Array<{ link?: string }>;
          share_link?: string;
          job_id?: string;
        }>;
      };

      return (data.jobs_results || [])
        .map((job) => {
          const url =
            job.apply_options?.[0]?.link ||
            job.share_link ||
            (job.job_id ? `https://${board.siteFilter}` : '');
          return {
            title: job.title || 'Unknown',
            company: board.name,
            location: job.location || 'Unknown',
            description: job.description || job.title || '',
            salary: '',
            url,
            source: board.source,
            postedDate: new Date().toISOString().split('T')[0],
            externalId: job.job_id,
          };
        })
        .filter((j) => j.url)
        .slice(0, MAX_PER_COMPANY);
    } catch (error) {
      this.logger.warn(`Serp site search failed for ${board.name}`, error);
      return [];
    }
  }

  private matchesQuery(title: string, terms: string[]): boolean {
    if (terms.length === 0) return true;
    const lower = title.toLowerCase();
    return terms.some((term) => lower.includes(term));
  }

  private titleFromPath(path: string): string {
    const slug = path.split('/')[3] || path;
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private locationFromPaloPath(path: string): string {
    const city = path.split('/')[3]?.replace(/-/g, ' ') || 'Unknown';
    return city.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
  }
}
