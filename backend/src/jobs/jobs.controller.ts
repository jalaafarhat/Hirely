import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsEnum } from 'class-validator';
import { FeedbackType } from '@prisma/client';

class FeedbackDto {
  @IsEnum(FeedbackType)
  type: FeedbackType;
}

@Controller('jobs')
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('minScore') minScore?: string,
    @Query('source') source?: string,
    @Query('workMode') workMode?: string,
    @Query('company') company?: string,
    @Query('sort') sort?: string,
  ) {
    return this.jobsService.listJobs(userId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      minScore: minScore ? parseInt(minScore) : undefined,
      source,
      workMode,
      company,
      sort,
    });
  }

  @Post(':id/save')
  save(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.jobsService.saveJob(userId, id);
  }

  @Delete(':id/save')
  unsave(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.jobsService.unsaveJob(userId, id);
  }

  @Post(':id/hide')
  hide(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.jobsService.hideJob(userId, id);
  }

  @Post(':id/applied')
  applied(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.jobsService.markApplied(userId, id);
  }

  @Post(':id/feedback')
  feedback(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: FeedbackDto,
  ) {
    return this.jobsService.submitFeedback(userId, id, dto.type);
  }
}

@Controller('saved-jobs')
export class SavedJobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.jobsService.listJobs(userId, { savedOnly: true });
  }
}
