import { Module } from '@nestjs/common';
import { JobMatchingService } from './job-matching.service';
import { DuplicateDetectionService } from './duplicate-detection.service';

@Module({
  providers: [JobMatchingService, DuplicateDetectionService],
  exports: [JobMatchingService, DuplicateDetectionService],
})
export class MatchingModule {}
