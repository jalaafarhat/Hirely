import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Profile, UserPreferences } from '@prisma/client';
import { MatchResult, NormalizedJob } from '../common/types';

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
    const prompt = `Score this job match for a candidate on a scale of 0-100.

Candidate Profile:
- Job Titles: ${profile.jobTitles.join(', ')}
- Skills: ${profile.skills.join(', ')}
- Technologies: ${profile.technologies.join(', ')}
- Experience: ${profile.yearsExperience} years
- Seniority: ${profile.seniority}
- Preferred work modes: ${preferences.workModes.join(', ')}
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
    let score = 50;
    const reasons: string[] = [];
    const jobText = `${job.title} ${job.description}`.toLowerCase();

    for (const tech of profile.technologies) {
      if (jobText.includes(tech.toLowerCase())) {
        score += 8;
        reasons.push(`Strong ${tech} match`);
      }
    }

    for (const skill of profile.skills.slice(0, 5)) {
      if (jobText.includes(skill.toLowerCase())) {
        score += 5;
        reasons.push(`${skill} skill match`);
      }
    }

    for (const title of profile.jobTitles) {
      if (job.title.toLowerCase().includes(title.toLowerCase())) {
        score += 10;
        reasons.push(`Title aligns with ${title}`);
      }
    }

    for (const liked of preferences.likedKeywords) {
      if (jobText.includes(liked.toLowerCase())) score += 5;
    }

    for (const disliked of preferences.dislikedKeywords) {
      if (jobText.includes(disliked.toLowerCase())) score -= 10;
    }

    if (job.location.toLowerCase().includes('remote') &&
        preferences.workModes.includes('REMOTE')) {
      score += 5;
      reasons.push('Remote preference matches');
    }

    return {
      matchScore: Math.min(100, Math.max(0, score)),
      reasoning: reasons.slice(0, 4).join('. ') || 'General profile match',
    };
  }
}
