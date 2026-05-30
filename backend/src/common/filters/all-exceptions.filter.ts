import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object') {
        const obj = exResponse as Record<string, unknown>;
        message = (obj.message as string) || message;
        errors = obj.errors;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P1001' || exception.code === 'P1000') {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          'Database is unavailable. Start Docker Desktop, then run: docker compose up -d postgres redis';
      } else {
        this.logger.error(exception.message, exception.stack);
        message = 'Database error';
      }
    } else if (exception instanceof Error) {
      if (exception.message.includes("Can't reach database server")) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          'Database is unavailable. Start Docker Desktop, then run: docker compose up -d postgres redis';
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(errors ? { errors } : {}),
    });
  }
}
