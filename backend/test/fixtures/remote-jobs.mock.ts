import {
  JobType,
  LocationType,
  Profile,
  UserPreferences,
  WorkMode,
} from '@prisma/client';
import { NormalizedJob } from '../../src/common/types';

export const MOCK_USER_ID = 'test-user-remote-001';

export const israelRemotePreferences = (): UserPreferences => ({
  id: 'pref-israel-remote',
  userId: MOCK_USER_ID,
  locationType: LocationType.WORLDWIDE,
  country: 'Israel',
  city: null,
  workModes: [WorkMode.REMOTE],
  jobTypes: [JobType.FULL_TIME],
  minSalary: null,
  matchThreshold: 50,
  agentEnabled: true,
  digestHours: [9, 15],
  emailDigestEnabled: false,
  likedKeywords: [],
  dislikedKeywords: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

export const juniorProfile = (): Profile => ({
  id: 'profile-junior',
  userId: MOCK_USER_ID,
  name: 'Test User',
  email: 'test@hirely.app',
  phone: null,
  summary: 'Junior software engineer with 1 year experience.',
  jobTitles: ['Software Engineer'],
  skills: ['JavaScript', 'TypeScript', 'React'],
  technologies: ['Node.js', 'PostgreSQL'],
  yearsExperience: 1,
  education: [],
  certifications: [],
  industries: ['Technology'],
  languages: ['English'],
  locations: ['Israel'],
  seniority: 'Junior',
  rawParsedData: null,
  analyzedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

/** Remote job open to any country */
export const worldwideRemoteJob = (): NormalizedJob => ({
  title: 'Software Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  description:
    'Fully remote role. Work from anywhere in the world. 1-3 years experience with TypeScript.',
  salary: '',
  url: 'https://jobs.example.com/worldwide-remote',
  source: 'mock',
  postedDate: '2026-05-01',
});

/** Remote role restricted to India — should be excluded for Israel user */
export const indiaOnlyRemoteJob = (): NormalizedJob => ({
  title: 'Backend Developer',
  company: 'IndiaTech',
  location: 'Remote - India',
  description:
    'Remote position. Candidates must be based in India. 2+ years Node.js experience.',
  salary: '',
  url: 'https://jobs.example.com/india-only',
  source: 'mock',
  postedDate: '2026-05-01',
});

/** Remote role explicitly open to Israel */
export const israelRemoteJob = (): NormalizedJob => ({
  title: 'Full Stack Developer',
  company: 'TelAviv Startup',
  location: 'Remote - Israel',
  description:
    'Remote work from Israel. React and Node.js. 1-2 years experience welcome.',
  salary: '',
  url: 'https://jobs.example.com/israel-remote',
  source: 'mock',
  postedDate: '2026-05-01',
});

/** Senior role — should be filtered for 1-year candidate */
export const seniorRemoteJob = (): NormalizedJob => ({
  title: 'Senior Software Engineer',
  company: 'BigTech',
  location: 'Remote',
  description:
    'Worldwide remote. Minimum of 8 years experience. Lead distributed systems.',
  salary: '',
  url: 'https://jobs.example.com/senior-remote',
  source: 'mock',
  postedDate: '2026-05-01',
});

/** Junior role — should pass for 1-year candidate */
export const juniorRemoteJob = (): NormalizedJob => ({
  title: 'Junior Software Engineer',
  company: 'GrowthCo',
  location: 'Remote',
  description:
    'Entry-level remote role. 0-2 years experience. JavaScript and React.',
  salary: '',
  url: 'https://jobs.example.com/junior-remote',
  source: 'mock',
  postedDate: '2026-05-01',
});

/** Onsite job in US — not subject to remote country filter */
export const onsiteUsJob = (): NormalizedJob => ({
  title: 'Software Engineer',
  company: 'US Corp',
  location: 'New York, NY',
  description: 'Onsite role in New York. 2+ years experience.',
  salary: '',
  url: 'https://jobs.example.com/onsite-us',
  source: 'mock',
  postedDate: '2026-05-01',
});

export const allMockRemoteJobs = (): NormalizedJob[] => [
  worldwideRemoteJob(),
  indiaOnlyRemoteJob(),
  israelRemoteJob(),
  seniorRemoteJob(),
  juniorRemoteJob(),
  onsiteUsJob(),
];
