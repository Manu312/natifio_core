import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NotFoundExceptionFilter } from './common/filters/not-found-exception.filter';
import { UnauthorizedExceptionFilter } from './common/filters/unauthorized-exception.filter';

async function bootstrap() {
  // Silenciar logs en producción para no revelar stack
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: isProduction ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // CORS Configuration - Allow all origins dynamically
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global Validation Pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global filters: ocultar existencia del API en rutas no encontradas y accesos no autorizados
  app.useGlobalFilters(new NotFoundExceptionFilter(), new UnauthorizedExceptionFilter());

  // Swagger solo disponible en desarrollo
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Naty & Fio Core API')
      .setDescription('API for managing teachers, subjects, and bookings')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
