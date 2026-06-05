import {
  isExperienceCompatible,
  isJobRelevant,
  isRemoteEligibleForCountry,
  normalizeCountry,
  parseJobExperienceRequirement,
} from './job-relevance.util';
import {
  allMockRemoteJobs,
  indiaOnlyRemoteJob,
  israelRemoteJob,
  israelRemotePreferences,
  juniorProfile,
  juniorRemoteJob,
  onsiteUsJob,
  seniorRemoteJob,
  worldwideRemoteJob,
} from '../../test/fixtures/remote-jobs.mock';

describe('job-relevance.util (remote jobs)', () => {
  const profile = juniorProfile();
  const preferences = israelRemotePreferences();

  describe('normalizeCountry', () => {
    it('normalizes Israel aliases', () => {
      expect(normalizeCountry('Israel')).toBe('israel');
      expect(normalizeCountry('Tel Aviv')).toBe('israel');
    });

    it('normalizes India aliases', () => {
      expect(normalizeCountry('India')).toBe('india');
      expect(normalizeCountry('Indian')).toBe('india');
    });
  });

  describe('isRemoteEligibleForCountry', () => {
    it('allows worldwide remote jobs for Israel user', () => {
      expect(
        isRemoteEligibleForCountry(worldwideRemoteJob(), 'Israel'),
      ).toBe(true);
    });

    it('blocks India-only remote jobs for Israel user', () => {
      expect(isRemoteEligibleForCountry(indiaOnlyRemoteJob(), 'Israel')).toBe(
        false,
      );
    });

    it('allows Israel-specific remote jobs', () => {
      expect(isRemoteEligibleForCountry(israelRemoteJob(), 'Israel')).toBe(
        true,
      );
    });

    it('allows jobs with no country restrictions', () => {
      const openJob = {
        ...worldwideRemoteJob(),
        description: 'Remote software engineer. TypeScript required.',
      };
      expect(isRemoteEligibleForCountry(openJob, 'Israel')).toBe(true);
    });
  });

  describe('parseJobExperienceRequirement', () => {
    it('detects senior level from title', () => {
      const req = parseJobExperienceRequirement(
        seniorRemoteJob().title,
        seniorRemoteJob().description,
      );
      expect(req.inferredLevel).toBe('senior');
      expect(req.minYears).toBeGreaterThanOrEqual(5);
    });

    it('detects junior level from title', () => {
      const req = parseJobExperienceRequirement(
        juniorRemoteJob().title,
        juniorRemoteJob().description,
      );
      expect(req.inferredLevel).toBe('junior');
    });
  });

  describe('isExperienceCompatible', () => {
    it('rejects senior roles for 1-year candidate', () => {
      expect(
        isExperienceCompatible(
          1,
          seniorRemoteJob().title,
          seniorRemoteJob().description,
        ),
      ).toBe(false);
    });

    it('accepts junior roles for 1-year candidate', () => {
      expect(
        isExperienceCompatible(
          1,
          juniorRemoteJob().title,
          juniorRemoteJob().description,
        ),
      ).toBe(true);
    });
  });

  describe('isJobRelevant (full filter)', () => {
    it('keeps eligible remote jobs and drops India-only + senior roles', () => {
      const relevant = allMockRemoteJobs().filter((job) =>
        isJobRelevant(job, profile, preferences),
      );
      const urls = relevant.map((j) => j.url);

      expect(urls).toContain(worldwideRemoteJob().url);
      expect(urls).toContain(israelRemoteJob().url);
      expect(urls).toContain(juniorRemoteJob().url);
      expect(urls).toContain(onsiteUsJob().url);
      expect(urls).not.toContain(indiaOnlyRemoteJob().url);
      expect(urls).not.toContain(seniorRemoteJob().url);
    });

    it('does not apply remote country filter when country is unset', () => {
      const prefsNoCountry = { ...preferences, country: null };
      expect(
        isJobRelevant(indiaOnlyRemoteJob(), profile, prefsNoCountry),
      ).toBe(true);
    });

    it('does not apply remote country filter for non-remote preferences', () => {
      const onsitePrefs = {
        ...preferences,
        workModes: ['ONSITE' as const],
      };
      expect(
        isJobRelevant(indiaOnlyRemoteJob(), profile, onsitePrefs),
      ).toBe(true);
    });
  });
});
