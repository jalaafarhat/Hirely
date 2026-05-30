import { Module } from '@nestjs/common';
import {
  JobSourceService,
  SerpApiJobProvider,
  LinkedInProvider,
  IndeedProvider,
  GlassdoorProvider,
  GreenhouseProvider,
  LeverProvider,
  AshbyProvider,
  WellfoundProvider,
} from './job-source.service';
import { CompanyCareersProvider } from './company-careers.provider';

@Module({
  providers: [
    SerpApiJobProvider,
    LinkedInProvider,
    IndeedProvider,
    GlassdoorProvider,
    GreenhouseProvider,
    LeverProvider,
    AshbyProvider,
    WellfoundProvider,
    CompanyCareersProvider,
    JobSourceService,
  ],
  exports: [JobSourceService],
})
export class SourcesModule {}
