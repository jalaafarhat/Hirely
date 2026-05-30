import { Module } from '@nestjs/common';
import { JobsController, SavedJobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [FeedbackModule],
  controllers: [JobsController, SavedJobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
