import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  @Get('status')
  getStatus(@CurrentUser('id') userId: string) {
    return this.billing.getStatus(userId);
  }

  @Post('checkout')
  createCheckout(@CurrentUser('id') userId: string) {
    return this.billing.createCheckoutSession(userId);
  }

  @Post('confirm')
  confirm(
    @CurrentUser('id') userId: string,
    @Body() body: { subscriptionId?: string },
    @Query('subscription_id') subscriptionIdQuery?: string,
  ) {
    return this.billing.confirmSubscription(
      userId,
      body?.subscriptionId || subscriptionIdQuery,
    );
  }

  @Post('cancel')
  cancel(@CurrentUser('id') userId: string) {
    return this.billing.cancelSubscription(userId);
  }

  @Post('dev-activate')
  activateDev(@CurrentUser('id') userId: string) {
    return this.billing.activateDevSubscription(userId);
  }

  @Public()
  @Post('webhook')
  @UsePipes(
    new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }),
  )
  async webhook(@Body() body: Record<string, unknown>) {
    await this.billing.handleWebhook(body || {});
    return { received: true };
  }
}
