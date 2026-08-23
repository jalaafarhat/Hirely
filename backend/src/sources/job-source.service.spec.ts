import {
  parseLinkedInOrganicTitle,
  SerpApiJobProvider,
} from './job-source.service';
import { ConfigService } from '@nestjs/config';

describe('parseLinkedInOrganicTitle', () => {
  it('parses title and company from LinkedIn organic result', () => {
    expect(
      parseLinkedInOrganicTitle('Software Engineer - Google | LinkedIn'),
    ).toEqual({ title: 'Software Engineer', company: 'Google' });
  });

  it('handles title only', () => {
    expect(parseLinkedInOrganicTitle('Backend Developer | LinkedIn')).toEqual({
      title: 'Backend Developer',
      company: 'Unknown',
    });
  });
});

describe('SerpApiJobProvider organic LinkedIn', () => {
  it('maps organic Google results to linkedin jobs', async () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'SERPAPI_API_KEY' ? 'test-key' : undefined,
      ),
    };
    const provider = new SerpApiJobProvider(config as unknown as ConfigService);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          organic_results: [
            {
              title: 'DevOps Engineer - Monday.com | LinkedIn',
              link: 'https://www.linkedin.com/jobs/view/1234567890',
              snippet: 'Remote DevOps role in Israel',
            },
          ],
        }),
    });

    const jobs = await provider.searchOrganicSite(
      'linkedin.com/jobs/view',
      'devops engineer remote',
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0].source).toBe('linkedin');
    expect(jobs[0].url).toContain('linkedin.com/jobs/view');
    expect(jobs[0].company).toBe('Monday.com');
  });
});
