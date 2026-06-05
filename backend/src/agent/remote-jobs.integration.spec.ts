import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LocationType, WorkMode } from '@prisma/client';
import { AgentService } from './agent.service';
import { ProfileAnalyzerService } from '../cv/profile-analyzer.service';
import { JobSourceService } from '../sources/job-source.service';
import { JobMatchingService } from '../matching/job-matching.service';
import { DuplicateDetectionService } from '../matching/duplicate-detection.service';
import { EmailDigestService } from '../email/email-digest.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  allMockRemoteJobs,
  indiaOnlyRemoteJob,
  israelRemoteJob,
  israelRemotePreferences,
  juniorProfile,
  juniorRemoteJob,
  MOCK_USER_ID,
  seniorRemoteJob,
  worldwideRemoteJob,
} from '../../test/fixtures/remote-jobs.mock';

describe('Remote jobs integration (mock data)', () => {
  let agentService: AgentService;
  let jobSourceSearchAll: jest.Mock;
  let jobSourceSearchCompanyBoards: jest.Mock;
  let matchJobMock: jest.Mock;
  let prismaUserFindUnique: jest.Mock;

  const mockRun = { id: 'run-1', userId: MOCK_USER_ID };

  const mockUser = {
    id: MOCK_USER_ID,
    email: 'test@hirely.app',
    timezone: 'Asia/Jerusalem',
    profile: juniorProfile(),
    preferences: israelRemotePreferences(),
    cvFile: { id: 'cv-1' },
  };

  beforeEach(async () => {
    jobSourceSearchAll = jest.fn().mockResolvedValue(allMockRemoteJobs());
    jobSourceSearchCompanyBoards = jest
      .fn()
      .mockResolvedValue([israelRemoteJob()]);
    prismaUserFindUnique = jest.fn().mockResolvedValue(mockUser);
    matchJobMock = jest.fn().mockImplementation((job) => {
      if (job.url === seniorRemoteJob().url) {
        return Promise.resolve({ matchScore: 25, reasoning: 'Too senior' });
      }
      if (job.url === indiaOnlyRemoteJob().url) {
        return Promise.resolve({
          matchScore: 90,
          reasoning: 'Should have been pre-filtered',
        });
      }
      return Promise.resolve({
        matchScore: 82,
        reasoning: 'Good remote match for Israel junior candidate',
      });
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: PrismaService,
          useValue: {
            agentRun: {
              create: jest.fn().mockResolvedValue(mockRun),
              update: jest.fn().mockResolvedValue(mockRun),
            },
            user: {
              findUnique: prismaUserFindUnique,
            },
            job: {
              upsert: jest.fn().mockImplementation(({ create }) =>
                Promise.resolve({ id: `job-${create.url}`, ...create }),
              ),
            },
            jobMatch: {
              upsert: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: ProfileAnalyzerService,
          useValue: {
            generateSearchQueries: jest
              .fn()
              .mockResolvedValue([
                'Software Engineer',
                'Junior Software Engineer',
              ]),
          },
        },
        {
          provide: JobSourceService,
          useValue: {
            searchAll: jobSourceSearchAll,
            searchCompanyBoards: jobSourceSearchCompanyBoards,
          },
        },
        {
          provide: JobMatchingService,
          useValue: { matchJob: matchJobMock },
        },
        {
          provide: DuplicateDetectionService,
          useValue: {
            filterNewJobs: jest
              .fn()
              .mockImplementation((_userId, jobs) => Promise.resolve(jobs)),
          },
        },
        {
          provide: EmailDigestService,
          useValue: {
            sendDailyDigest: jest.fn(),
          },
        },
        {
          provide: getQueueToken('job-agent'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    agentService = module.get(AgentService);
  });

  it('runs agent pipeline and filters India-only and senior remote jobs', async () => {
    const result = await agentService.runForUser(MOCK_USER_ID, {
      sendEmail: false,
    });

    expect(result.jobsFound).toBeGreaterThan(0);
    expect(result.jobsMatched).toBeGreaterThan(0);

    const matchedUrls = matchJobMock.mock.calls.map((call) => call[0].url);

    expect(matchedUrls).not.toContain(indiaOnlyRemoteJob().url);
    expect(matchedUrls).not.toContain(seniorRemoteJob().url);
    expect(matchedUrls).toContain(worldwideRemoteJob().url);
    expect(matchedUrls).toContain(juniorRemoteJob().url);
    expect(matchedUrls).toContain(israelRemoteJob().url);
  });

  it('passes Israel as search location and country for remote preferences', async () => {
    await agentService.runForUser(MOCK_USER_ID, { sendEmail: false });

    expect(jobSourceSearchAll).toHaveBeenCalled();
    const firstSearchCall = jobSourceSearchAll.mock.calls[0];
    expect(firstSearchCall[0]).toMatch(/remote/i);
    expect(firstSearchCall[0]).toMatch(/israel/i);
    expect(firstSearchCall[1]).toBe('Israel');

    expect(jobSourceSearchCompanyBoards).toHaveBeenCalledWith(
      expect.objectContaining({ yearsExperience: 1 }),
      expect.objectContaining({
        country: 'Israel',
        remote: true,
        location: 'Israel',
      }),
    );
  });

  it('rejects agent run when remote is enabled without country', async () => {
    prismaUserFindUnique.mockResolvedValue({
      ...mockUser,
      preferences: {
        ...israelRemotePreferences(),
        country: null,
      },
    });

    await expect(agentService.runNowForUser(MOCK_USER_ID)).rejects.toThrow(
      /country/i,
    );
  });
});

describe('Remote search query building', () => {
  let agentService: AgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: PrismaService, useValue: {} },
        { provide: ProfileAnalyzerService, useValue: {} },
        { provide: JobSourceService, useValue: {} },
        { provide: JobMatchingService, useValue: {} },
        { provide: DuplicateDetectionService, useValue: {} },
        { provide: EmailDigestService, useValue: {} },
        {
          provide: getQueueToken('job-agent'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    agentService = module.get(AgentService);
  });

  it('appends remote and country to base queries', () => {
    const queries = (
      agentService as unknown as {
        buildSearchQueries: (
          base: string[],
          remote: boolean,
          country?: string,
        ) => string[];
      }
    ).buildSearchQueries(['Software Engineer'], true, 'Israel');

    expect(queries).toEqual(['Software Engineer remote Israel']);
  });

  it('uses country as SerpAPI location when remote is preferred', () => {
    const location = (
      agentService as unknown as {
        resolveSearchLocation: (prefs: {
          locationType: string;
          country: string | null;
          city: string | null;
          workModes: string[];
        }) => string | undefined;
      }
    ).resolveSearchLocation({
      locationType: LocationType.WORLDWIDE,
      country: 'Israel',
      city: null,
      workModes: [WorkMode.REMOTE],
    });

    expect(location).toBe('Israel');
  });
});
