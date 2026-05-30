import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { AgentProcessor } from './agent.processor';
import { CVModule } from '../cv/cv.module';
import { SourcesModule } from '../sources/sources.module';
import { MatchingModule } from '../matching/matching.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'job-agent' }),
    CVModule,
    SourcesModule,
    MatchingModule,
    EmailModule,
  ],
  controllers: [AgentController],
  providers: [AgentService, AgentProcessor],
  exports: [AgentService],
})
export class AgentModule {}
