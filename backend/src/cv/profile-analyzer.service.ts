import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedProfile } from '../common/types';

const PROFILE_SCHEMA = `{
  "name": "string - full name from CV header",
  "email": "string - email if present, else empty",
  "phone": "string - phone if present, else empty",
  "summary": "string - 2-3 sentence professional summary based on CV only",
  "jobTitles": ["array of target/recent job titles, max 5, from actual roles in CV"],
  "skills": ["soft and professional skills, e.g. Leadership, Agile, Communication"],
  "technologies": ["tools, languages, frameworks, platforms explicitly mentioned"],
  "yearsExperience": "number - total years computed from employment dates, integer",
  "education": [{"degree": "string", "institution": "string", "year": "string optional"}],
  "certifications": ["certification names only"],
  "industries": ["industries worked in"],
  "languages": ["spoken languages"],
  "locations": ["cities/countries from CV or work history"],
  "seniority": "one of: Intern, Junior, Mid, Senior, Lead, Principal, Manager, Director, or empty"
}`;

@Injectable()
export class ProfileAnalyzerService {
  private readonly logger = new Logger(ProfileAnalyzerService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GOOGLE_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async analyzeProfile(cvText: string): Promise<ParsedProfile> {
    if (!this.genAI) {
      this.logger.warn('No Google API key — returning empty profile');
      return this.emptyProfile();
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const prompt = `You are an expert CV/resume parser. Extract a structured professional profile from the CV text below.

RULES:
- Use ONLY information explicitly stated in the CV. Do not invent or assume.
- jobTitles: use actual job titles from work experience (most recent first). Not aspirational titles.
- skills: non-technical professional skills (communication, project management, etc.)
- technologies: programming languages, frameworks, databases, cloud platforms, tools (React, Python, AWS, etc.)
- yearsExperience: calculate from employment history dates to today. If unclear, estimate conservatively.
- seniority: infer from most recent role level and years of experience.
- education: list each degree with institution and graduation year if available.
- Keep arrays deduplicated and concise (max 15 items per array).
- Return valid JSON only matching this schema:
${PROFILE_SCHEMA}

CV TEXT:
${cvText.slice(0, 20000)}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text) as ParsedProfile;
      return this.normalizeProfile(parsed);
    } catch (error) {
      this.logger.error('Profile analysis failed, retrying without JSON mode', error);
      return this.analyzeProfileFallback(cvText);
    }
  }

  private async analyzeProfileFallback(cvText: string): Promise<ParsedProfile> {
    if (!this.genAI) return this.emptyProfile();

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Extract professional profile from this CV as JSON only:\n${PROFILE_SCHEMA}\n\nCV:\n${cvText.slice(0, 15000)}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON');
      return this.normalizeProfile(JSON.parse(jsonMatch[0]) as ParsedProfile);
    } catch (error) {
      this.logger.error('Profile analysis fallback failed', error);
      return this.emptyProfile();
    }
  }

  normalizeProfile(parsed: Partial<ParsedProfile>): ParsedProfile {
    const cleanArray = (arr: unknown): string[] => {
      if (!Array.isArray(arr)) return [];
      return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))].slice(
        0,
        20,
      );
    };

    return {
      name: String(parsed.name || '').trim(),
      email: String(parsed.email || '').trim(),
      phone: String(parsed.phone || '').trim(),
      summary: String(parsed.summary || '').trim(),
      jobTitles: cleanArray(parsed.jobTitles),
      skills: cleanArray(parsed.skills),
      technologies: cleanArray(parsed.technologies),
      yearsExperience: Math.max(0, Number(parsed.yearsExperience) || 0),
      education: Array.isArray(parsed.education) ? parsed.education : [],
      certifications: cleanArray(parsed.certifications),
      industries: cleanArray(parsed.industries),
      languages: cleanArray(parsed.languages),
      locations: cleanArray(parsed.locations),
      seniority: String(parsed.seniority || '').trim(),
    };
  }

  async generateSearchQueries(profile: ParsedProfile): Promise<string[]> {
    const baseQueries = new Set<string>();

    const years = profile.yearsExperience ?? 0;
    const levelPrefix =
      years <= 2 ? 'Junior' : years >= 7 ? 'Senior' : years >= 4 ? 'Mid' : '';

    for (const title of profile.jobTitles.slice(0, 3)) {
      baseQueries.add(title);
      if (levelPrefix) {
        baseQueries.add(`${levelPrefix} ${title}`);
      }
      if (profile.seniority) {
        baseQueries.add(`${profile.seniority} ${title}`);
      }
    }

    for (const tech of profile.technologies.slice(0, 5)) {
      baseQueries.add(`${tech} Developer`);
      baseQueries.add(`${tech} Engineer`);
    }

    for (const skill of profile.skills.slice(0, 5)) {
      baseQueries.add(`${skill} Developer`);
    }

    if (profile.summary && baseQueries.size < 3) {
      const words = profile.summary.split(/\s+/).slice(0, 6).join(' ');
      if (words.length > 10) baseQueries.add(words);
    }

    if (baseQueries.size === 0) {
      baseQueries.add('Software Engineer');
      baseQueries.add('Remote Developer');
    }

    return Array.from(baseQueries).slice(0, 8);
  }

  private emptyProfile(): ParsedProfile {
    return {
      name: '',
      email: '',
      phone: '',
      summary: '',
      jobTitles: [],
      skills: [],
      technologies: [],
      yearsExperience: 0,
      education: [],
      certifications: [],
      industries: [],
      languages: [],
      locations: [],
      seniority: '',
    };
  }
}
