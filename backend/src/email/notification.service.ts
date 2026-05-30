import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { Resend } from 'resend';



export interface EmailSendResult {

  sent: boolean;

  error?: string;

  verifyLink?: string;

}



@Injectable()

export class NotificationService {

  private readonly logger = new Logger(NotificationService.name);

  private resend: Resend | null = null;

  private fromEmail: string;

  private readonly isDev: boolean;



  constructor(private config: ConfigService) {

    const apiKey = this.config.get<string>('RESEND_API_KEY');

    this.isDev = this.config.get<string>('NODE_ENV') !== 'production';

    this.fromEmail = this.resolveFromAddress(

      this.config.get<string>('EMAIL_FROM') || 'Hirely <noreply@hirely.app>',

    );

    if (apiKey) {

      this.resend = new Resend(apiKey);

    }

    this.logger.log(`Email sender configured: ${this.fromEmail}`);

  }



  private resolveFromAddress(configured: string): string {

    if (!this.isDev) return configured;

    if (configured.includes('@hirely.app') || configured.includes('@hirely.com')) {

      return 'Hirely <onboarding@resend.dev>';

    }

    return configured;

  }



  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {

    const result = await this.sendEmailDetailed(to, subject, html);

    return result.sent;

  }



  async sendEmailDetailed(

    to: string,

    subject: string,

    html: string,

  ): Promise<EmailSendResult> {

    if (!this.resend) {

      this.logger.warn(`Email not sent (no Resend key): ${subject} -> ${to}`);

      return { sent: false, error: 'Email service not configured' };

    }



    try {

      const { data, error } = await this.resend.emails.send({

        from: this.fromEmail,

        to,

        subject,

        html,

      });



      if (error) {

        this.logger.error(`Resend rejected email to ${to}: ${error.message}`);

        return { sent: false, error: error.message };

      }



      this.logger.log(`Email sent to ${to} (${subject}) id=${data?.id || 'unknown'}`);

      return { sent: true };

    } catch (error) {

      const message = error instanceof Error ? error.message : 'Unknown email error';

      this.logger.error(`Failed to send email to ${to}`, error);

      return { sent: false, error: message };

    }

  }



  async sendVerificationEmail(

    email: string,

    token: string,

  ): Promise<EmailSendResult> {

    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:4200';

    const link = `${appUrl}/verify-email?token=${token}`;



    const result = await this.sendEmailDetailed(

      email,

      'Verify your Hirely account',

      `<h2>Welcome to Hirely!</h2>

       <p>Click the link below to verify your email:</p>

       <a href="${link}">${link}</a>`,

    );



    if (!result.sent) {

      if (this.isDev) {

        this.logger.warn(

          `[DEV] Verification email could not be sent to ${email}. Use this link instead:\n${link}`,

        );

      } else {

        this.logger.error(`Verification email failed for ${email}`);

      }

    }



    return { ...result, verifyLink: this.isDev ? link : undefined };

  }



  async sendPasswordResetEmail(email: string, token: string) {

    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:4200';

    const link = `${appUrl}/reset-password?token=${token}`;

    const result = await this.sendEmailDetailed(

      email,

      'Reset your Hirely password',

      `<h2>Password Reset</h2>

       <p>Click the link below to reset your password:</p>

       <a href="${link}">${link}</a>

       <p>This link expires in 1 hour.</p>`,

    );



    if (!result.sent && this.isDev) {

      this.logger.warn(`[DEV] Password reset link for ${email}:\n${link}`);

    }

  }

}

