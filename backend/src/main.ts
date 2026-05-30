import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

function isAllowedDevOrigin(origin: string, appUrl: string): boolean {
  if (origin === appUrl) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin)) return true;
  return false;
}

function isAllowedProdOrigin(
  origin: string,
  appUrl: string,
  extraOrigins: string[],
): boolean {
  if (origin === appUrl) return true;
  if (extraOrigins.includes(origin)) return true;
  if (/^https:\/\/([a-z0-9-]+\.)*vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/(www\.)?hirelycareeragent\.com$/.test(origin)) return true;
  return false;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const isDev = config.get<string>('NODE_ENV') !== 'production';
  const appUrl = config.get<string>('APP_URL') || 'http://localhost:4200';
  const extraOrigins =
    config.get<string>('CORS_ORIGINS')?.split(',').map((o) => o.trim()).filter(Boolean) || [];

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isDev && isAllowedDevOrigin(origin, appUrl)) {
        callback(null, true);
        return;
      }
      if (!isDev && isAllowedProdOrigin(origin, appUrl, extraOrigins)) {
        callback(null, true);
        return;
      }
      if (extraOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Hirely API running on http://0.0.0.0:${port}/api/v1`);
}
bootstrap();
