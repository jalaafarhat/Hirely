import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Profile, UserPreferences } from '@prisma/client';
import { MatchResult, NormalizedJob } from '../common/types';
import {
  experienceFitScore,
  isExperienceCompatible,
  parseJobExperienceRequirement,
} from './job-relevance.util';

@Injectable()
export class JobMatchingService {
  private readonly logger = new Logger(JobMatchingService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GOOGLE_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async matchJob(
    job: NormalizedJob,
    profile: Profile,
    preferences: UserPreferences,
  ): Promise<MatchResult> {
    if (!this.genAI) {
      return this.heuristicMatch(job, profile, preferences);
    }

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const userCountry = preferences.country?.trim();
    const prompt = `Score this job match for a candidate on a scale of 0-100.

CRITICAL RULES (apply in order):
1. YEARS OF EXPERIENCE is the most important factor. If the job clearly requires more experience than the candidate has (e.g. Senior/5+ years role for a 1-year candidate), score below 35 even if skills match.
2. Prefer junior/entry/mid roles for junior candidates; penalize senior/principal/staff titles when experience is low.
3. Skills and technologies are secondary — only boost the score when experience level also fits.
4. For remote jobs${userCountry ? `: if the listing restricts eligible countries and "${userCountry}" is NOT eligible (e.g. "India only", "US residents only"), score 0` : ''}.

Candidate Profile:
- Job Titles: ${profile.jobTitles.join(', ')}
- Skills: ${profile.skills.join(', ')}
- Technologies: ${profile.technologies.join(', ')}
- Experience: ${profile.yearsExperience} years
- Seniority: ${profile.seniority}
- Preferred work modes: ${preferences.workModes.join(', ')}
- Candidate country: ${userCountry || 'not specified'}
- Liked keywords: ${preferences.likedKeywords.join(', ')}
- Disliked keywords: ${preferences.dislikedKeywords.join(', ')}

Job:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Description: ${job.description.slice(0, 2000)}

Return ONLY valid JSON: {"matchScore": 0, "reasoning": "brief explanation"}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON');
      const parsed = JSON.parse(jsonMatch[0]) as MatchResult;
      return {
        matchScore: Math.min(100, Math.max(0, parsed.matchScore)),
        reasoning: parsed.reasoning || '',
      };
    } catch (error) {
      this.logger.error('AI matching failed, using heuristic', error);
      return this.heuristicMatch(job, profile, preferences);
    }
  }

  private heuristicMatch(
    job: NormalizedJob,
    profile: Profile,
    preferences: UserPreferences,
  ): MatchResult {
    const reasons: string[] = [];
    const jobText = `${job.title} ${job.description}`.toLowerCase();

    if (
      !isExperienceCompatible(
        profile.yearsExperience,
        job.title,
        job.description,
      )
    ) {
      const req = parseJobExperienceRequirement(job.title, job.description);
      return {
        matchScore: 20,
        reasoning: `Requires ~${req.minYears}+ years (${req.inferredLevel} level); you have ${profile.yearsExperience} years`,
      };
    }

    let score = experienceFitScore(
      profile.yearsExperience,
      job.title,
      job.description,
    );
    reasons.push(
      `Experience fit for ${profile.yearsExperience} year candidate`,
    );

    let techMatches = 0;
    for (const tech of profile.technologies) {
      if (techMatches >= 3) break;
      if (jobText.includes(tech.toLowerCase())) {
        score += 5;
        techMatches++;
        reasons.push(`${tech} match`);
      }
    }

    let skillMatches = 0;
    for (const skill of profile.skills.slice(0, 5)) {
      if (skillMatches >= 2) break;
      if (jobText.includes(skill.toLowerCase())) {
        score += 3;
        skillMatches++;
      }
    }

    for (const title of profile.jobTitles) {
      if (job.title.toLowerCase().includes(title.toLowerCase())) {
        score += 12;
        reasons.push(`Title aligns with ${title}`);
        break;
      }
    }

    for (const liked of preferences.likedKeywords) {
      if (jobText.includes(liked.toLowerCase())) score += 4;
    }

    for (const disliked of preferences.dislikedKeywords) {
      if (jobText.includes(disliked.toLowerCase())) score -= 12;
    }

    if (
      job.location.toLowerCase().includes('remote') &&
      preferences.workModes.includes('REMOTE')
    ) {
      score += 5;
      reasons.push('Remote preference matches');
    }

    return {
      matchScore: Math.min(100, Math.max(0, score)),
      reasoning: reasons.slice(0, 4).join('. ') || 'General profile match',
    };
  }
}
