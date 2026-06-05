import { NormalizedJob } from '../common/types';
import { Profile, UserPreferences } from '@prisma/client';

const COUNTRY_ALIASES: Record<string, string[]> = {
  israel: ['israel', 'israeli', 'tel aviv', 'tel-aviv', 'herzliya', 'haifa'],
  india: ['india', 'indian', 'bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'delhi'],
  'united states': [
    'united states',
    'usa',
    'u.s.',
    'us only',
    'america',
    'american',
  ],
  'united kingdom': ['united kingdom', 'uk', 'britain', 'british', 'london'],
  canada: ['canada', 'canadian', 'toronto', 'vancouver'],
  germany: ['germany', 'german', 'berlin', 'munich'],
  france: ['france', 'french', 'paris'],
  netherlands: ['netherlands', 'dutch', 'amsterdam'],
  australia: ['australia', 'australian', 'sydney', 'melbourne'],
  poland: ['poland', 'polish', 'warsaw'],
  ukraine: ['ukraine', 'ukrainian'],
  brazil: ['brazil', 'brazilian'],
  mexico: ['mexico', 'mexican'],
};

const WORLDWIDE_PATTERNS = [
  /work from anywhere/i,
  /anywhere in the world/i,
  /worldwide remote/i,
  /global(?:ly)? remote/i,
  /no location restriction/i,
  /open to all location/i,
  /remote\s*[-–]?\s*global/i,
  /fully remote.*any country/i,
];

const RESTRICTIVE_PATTERNS = [
  /(?:must be|required to be|only for|limited to|restricted to|open to)\s+(?:candidates\s+)?(?:who\s+are\s+)?(?:based|located|residing|living)\s+in\s+(?:the\s+)?([a-z][a-z\s,&-]{2,40})/gi,
  /(?:candidates|applicants|employees)\s+(?:must|should)\s+be\s+(?:based|located|residing)\s+in\s+(?:the\s+)?([a-z][a-z\s,&-]{2,40})/gi,
  /(?:eligible|authorized)\s+to\s+work\s+in\s+(?:the\s+)?([a-z][a-z\s,&-]{2,40})/gi,
  /(?:citizens?|residents?|nationals?)\s+of\s+(?:the\s+)?([a-z][a-z\s,&-]{2,40})/gi,
  /([a-z][a-z\s]{2,30})\s+only\b/gi,
  /hiring\s+in\s+([a-z][a-z\s,&-]{2,40})\s+only/gi,
];

const SENIOR_TITLE_PATTERNS = [
  /\bprincipal\b/i,
  /\bstaff\b/i,
  /\bdirector\b/i,
  /\bvp\b/i,
  /\bhead of\b/i,
  /\barchitect\b/i,
];

const MID_SENIOR_TITLE_PATTERNS = [/\bsenior\b/i, /\bsr\.?\b/i, /\blead\b/i];

const JUNIOR_TITLE_PATTERNS = [
  /\bjunior\b/i,
  /\bjr\.?\b/i,
  /\bentry[\s-]?level\b/i,
  /\bgraduate\b/i,
  /\bassociate\b/i,
  /\bintern\b/i,
  /\btrainee\b/i,
];

export interface ExperienceRequirement {
  minYears: number;
  inferredLevel: 'intern' | 'junior' | 'mid' | 'senior' | 'staff';
}

export function normalizeCountry(country: string): string {
  const lower = country.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (canonical === lower || aliases.some((a) => lower.includes(a))) {
      return canonical;
    }
  }
  return lower;
}

function extractRestrictedCountries(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of RESTRICTIVE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of text.matchAll(regex)) {
      const raw = (match[1] || '').trim().toLowerCase();
      if (!raw || raw.length < 3) continue;
      const parts = raw.split(/,| and | or /).map((p) => p.trim());
      for (const part of parts) {
        if (part.length >= 3) found.add(part);
      }
    }
  }
  return Array.from(found);
}

export function isRemoteEligibleForCountry(
  job: NormalizedJob,
  userCountry?: string | null,
): boolean {
  if (!userCountry?.trim()) return true;

  const text = `${job.title} ${job.location} ${job.description}`;
  if (WORLDWIDE_PATTERNS.some((p) => p.test(text))) return true;

  const restricted = extractRestrictedCountries(text);
  if (restricted.length === 0) return true;

  const userNorm = normalizeCountry(userCountry);
  const userAliases = COUNTRY_ALIASES[userNorm] || [userNorm];

  const allowsUser = restricted.some((r) =>
    userAliases.some(
      (alias) => r.includes(alias) || alias.includes(r) || r === userNorm,
    ),
  );

  if (allowsUser) return true;

  const mentionsOnlyOtherCountries = restricted.every(
    (r) => !userAliases.some((alias) => r.includes(alias) || alias.includes(r)),
  );

  return !mentionsOnlyOtherCountries;
}

export function parseJobExperienceRequirement(
  title: string,
  description: string,
): ExperienceRequirement {
  const text = `${title} ${description}`.toLowerCase();

  let minYears = 0;
  const yearPatterns = [
    /(\d+)\s*\+\s*years?/gi,
    /(\d+)\s*[-–]\s*(\d+)\s*years?/gi,
    /minimum\s+of\s+(\d+)\s*years?/gi,
    /at least\s+(\d+)\s*years?/gi,
    /(\d+)\s*years?\s+of\s+experience/gi,
  ];

  for (const pattern of yearPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of text.matchAll(regex)) {
      const years = parseInt(match[1], 10);
      if (!Number.isNaN(years) && years > minYears) minYears = years;
    }
  }

  let inferredLevel: ExperienceRequirement['inferredLevel'] = 'mid';

  if (JUNIOR_TITLE_PATTERNS.some((p) => p.test(title))) {
    inferredLevel = 'junior';
    if (minYears === 0) minYears = 0;
    else minYears = Math.min(minYears, 2);
  } else if (SENIOR_TITLE_PATTERNS.some((p) => p.test(title))) {
    inferredLevel = 'staff';
    if (minYears < 7) minYears = Math.max(minYears, 7);
  } else if (MID_SENIOR_TITLE_PATTERNS.some((p) => p.test(title))) {
    inferredLevel = 'senior';
    if (minYears < 5) minYears = Math.max(minYears, 5);
  } else if (/\bengineer\s+ii\b/i.test(title)) {
    inferredLevel = 'mid';
    if (minYears < 2) minYears = Math.max(minYears, 2);
  } else if (/\bengineer\s+i\b/i.test(title) && !/\bii\b/i.test(title)) {
    inferredLevel = 'junior';
    if (minYears === 0) minYears = 0;
  }

  return { minYears, inferredLevel };
}

export function isExperienceCompatible(
  userYears: number,
  title: string,
  description: string,
): boolean {
  const req = parseJobExperienceRequirement(title, description);
  const slack = userYears <= 2 ? 1 : 2;

  if (req.minYears > userYears + slack) return false;

  if (userYears <= 2) {
    if (SENIOR_TITLE_PATTERNS.some((p) => p.test(title))) return false;
    if (req.inferredLevel === 'senior' || req.inferredLevel === 'staff') {
      return false;
    }
  }

  if (userYears <= 3 && MID_SENIOR_TITLE_PATTERNS.some((p) => p.test(title))) {
    if (req.minYears >= 5) return false;
  }

  return true;
}

export function experienceFitScore(
  userYears: number,
  title: string,
  description: string,
): number {
  const req = parseJobExperienceRequirement(title, description);
  const gap = req.minYears - userYears;

  if (gap > 3) return 0;
  if (gap > 1) return 15;
  if (gap === 1) return 35;
  if (gap === 0) return 50;
  if (gap < 0 && req.inferredLevel === 'junior' && userYears > 5) return 25;
  if (gap < 0) return 45;
  return 40;
}

export function isJobRelevant(
  job: NormalizedJob,
  profile: Profile,
  preferences: UserPreferences,
): boolean {
  const preferRemote = preferences.workModes.includes('REMOTE');
  const userCountry = preferences.country?.trim();

  if (preferRemote && userCountry) {
    const jobText = `${job.location} ${job.description}`.toLowerCase();
    const isRemoteJob =
      jobText.includes('remote') ||
      job.location.toLowerCase().includes('remote');

    if (isRemoteJob && !isRemoteEligibleForCountry(job, userCountry)) {
      return false;
    }
  }

  if (!isExperienceCompatible(profile.yearsExperience, job.title, job.description)) {
    return false;
  }

  return true;
}
