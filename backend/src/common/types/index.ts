export interface ParsedProfile {
  name: string;
  email: string;
  phone: string;
  summary: string;
  jobTitles: string[];
  skills: string[];
  technologies: string[];
  yearsExperience: number;
  education: Array<{ degree: string; institution: string; year?: string }>;
  certifications: string[];
  industries: string[];
  languages: string[];
  locations: string[];
  seniority: string;
}

export interface NormalizedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  salary: string;
  url: string;
  source: string;
  postedDate: string;
  workMode?: string;
  jobType?: string;
  externalId?: string;
}

export interface MatchResult {
  matchScore: number;
  reasoning: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface DashboardStats {
  newJobsToday: number;
  jobsThisWeek: number;
  averageMatchScore: number;
  totalJobsMatched: number;
  emailsSent: number;
}
