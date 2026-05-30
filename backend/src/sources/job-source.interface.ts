import { NormalizedJob } from '../common/types';

export interface JobSourceProvider {
  readonly name: string;
  search(query: string, location?: string): Promise<NormalizedJob[]>;
}

export const JOB_SOURCE_PROVIDERS = 'JOB_SOURCE_PROVIDERS';
