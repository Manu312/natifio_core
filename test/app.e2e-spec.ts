import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
    // Clean DB
    await prisma.booking.deleteMany();
    await prisma.availability.deleteMany();
    await prisma.subject.deleteMany();
    await prisma.teacher.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should create admin user directly', async () => {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
  });

  it('/auth/login (POST) - Admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'admin123',
      })
      .expect(201);

    expect(res.body).toHaveProperty('access_token');
    jwtToken = res.body.access_token;
  });

  it('/auth/register (POST) - as Admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        email: 'student@example.com',
        password: 'password123',
        role: 'ALUMNO',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe('student@example.com');
  });

  it('/teachers (POST) - Create Teacher', async () => {
    // First create a user for the teacher
    const userRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'teacher@example.com', password: 'pass', role: 'PROFESOR' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        userId: userRes.body.id,
        maxCapacity: 5,
      })
      .expect(201);

    expect(res.body.firstName).toBe('John');
  });

  afterAll(async () => {
    await app.close();
  });
});
