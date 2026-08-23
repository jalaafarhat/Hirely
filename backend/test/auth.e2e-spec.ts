import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers and logs in (requires migrated DB with trial_expires_at)', async () => {
    const email = `e2e-${Date.now()}@hirely.test`;
    const password = 'TestPass123!';
    const server = app.getHttpServer() as Server;

    await request(server)
      .post('/api/v1/auth/register')
      .send({ email, password, name: 'E2E User' })
      .expect((res) => expect(res.status).toBeLessThan(300));

    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const body = loginRes.body as {
      accessToken: string;
      user: { email: string };
    };
    expect(body.accessToken).toBeDefined();
    expect(body.user.email).toBe(email);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.trialExpiresAt).toBeTruthy();

    await prisma.user.delete({ where: { email } });
  });
});
