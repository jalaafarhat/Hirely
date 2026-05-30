import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EmailDigestService } from './email-digest.service';

@Module({
  providers: [NotificationService, EmailDigestService],
  exports: [NotificationService, EmailDigestService],
})
export class EmailModule {}
