import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    await prisma.user.deleteMany({
      where: { email: 'e2e-test@example.com' },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: 'e2e-test@example.com' },
    });
    await app.close();
  });

  it('/auth/register (POST) - should register a new user', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'e2e-test@example.com',
        password: 'Password123!',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.message).toBe('Account created successfully');
        expect(res.body.user.email).toBe('e2e-test@example.com');
        expect(res.body.user.password).toBeUndefined();
      });
  });

  it('/auth/login (POST) - should login and return tokens', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'e2e-test@example.com',
        password: 'Password123!',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.access_token).toBeDefined();
        expect(res.body.refresh_token).toBeDefined();
        expect(res.body.user.email).toBe('e2e-test@example.com');
      });
  });

  it('/auth/login (POST) - should fail with wrong password', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'e2e-test@example.com',
        password: 'WrongPassword',
      })
      .expect(401);
  });
});
