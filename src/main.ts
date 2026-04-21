// src/main.ts

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3001;
  const useApiGateway = configService.get<boolean>('app.useApiGateway') || false;

  // Prefijo global (solo si NO hay API Gateway)
  if (!useApiGateway) {
    app.setGlobalPrefix('api/triage');
  }

  // CORS
  app.enableCors({
    origin: configService.get<string>('app.frontendUrl') || 'http://localhost:5173',
    credentials: true,
  });

  // Validation Pipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(port);
  
  console.log(`asclepio-triage corriendo en http://localhost:${port}`);
  console.log(`Métricas disponibles en http://localhost:${port}/metrics`);
  console.log(`Health check en http://localhost:${port}/health`);
  console.log(`GraphQL Playground en http://localhost:${port}/graphql`);
}

bootstrap();