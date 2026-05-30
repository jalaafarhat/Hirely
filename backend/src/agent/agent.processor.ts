import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AgentService } from './agent.service';

@Processor('job-agent')
export class AgentProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentProcessor.name);

  constructor(private agentService: AgentService) {
    super();
  }

  async process(job: Job<{ userId: string; sendEmail?: boolean }>): Promise<void> {
    this.logger.log(`Processing agent job for user ${job.data.userId}`);
    await this.agentService.runForUser(job.data.userId, {
      sendEmail: job.data.sendEmail ?? true,
    });
  }
}
