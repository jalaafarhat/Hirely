export type CompanyBoardType =
  | 'amazon'
  | 'eightfold'
  | 'workday'
  | 'greenhouse'
  | 'paloalto'
  | 'google'
  | 'serp-site';

export interface CompanyBoardConfig {
  id: string;
  name: string;
  type: CompanyBoardType;
  source: string;
  /** Eightfold subdomain, e.g. "microsoft" */
  eightfoldHost?: string;
  domain?: string;
  careerBase?: string;
  /** Workday host + site path segment */
  workdayHost?: string;
  workdaySite?: string;
  /** Greenhouse board token */
  boardToken?: string;
  /** SerpAPI site: filter for careers pages without a public API */
  siteFilter?: string;
}

/** Top-tier employers searched directly on their career sites. */
export const TARGET_COMPANY_BOARDS: CompanyBoardConfig[] = [
  {
    id: 'google',
    name: 'Google',
    type: 'google',
    source: 'google',
  },
  {
    id: 'amazon',
    name: 'Amazon',
    type: 'amazon',
    source: 'amazon',
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    type: 'eightfold',
    source: 'microsoft',
    eightfoldHost: 'microsoft',
    domain: 'microsoft.com',
    careerBase: 'https://careers.microsoft.com',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    type: 'workday',
    source: 'nvidia',
    workdayHost: 'nvidia.wd5.myworkdayjobs.com',
    workdaySite: 'NVIDIAExternalCareerSite',
  },
  {
    id: 'apple',
    name: 'Apple',
    type: 'serp-site',
    source: 'apple',
    siteFilter: 'jobs.apple.com',
  },
  {
    id: 'meta',
    name: 'Meta',
    type: 'serp-site',
    source: 'meta',
    siteFilter: 'metacareers.com',
  },
  {
    id: 'appsflyer',
    name: 'AppsFlyer',
    type: 'greenhouse',
    source: 'appsflyer',
    boardToken: 'appsflyer',
  },
  {
    id: 'monday',
    name: 'Monday.com',
    type: 'serp-site',
    source: 'monday',
    siteFilter: 'monday.com/careers',
  },
  {
    id: 'booking',
    name: 'Booking.com',
    type: 'serp-site',
    source: 'booking',
    siteFilter: 'careers.booking.com',
  },
  {
    id: 'checkpoint',
    name: 'Check Point',
    type: 'serp-site',
    source: 'checkpoint',
    siteFilter: 'careers.checkpoint.com',
  },
  {
    id: 'paloalto',
    name: 'Palo Alto Networks',
    type: 'paloalto',
    source: 'paloalto',
  },
];

export const TARGET_COMPANY_NAMES = TARGET_COMPANY_BOARDS.map((c) => c.name);
