import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Si hay API Gateway, el Gateway maneja /api/triage
  // Si NO hay Gateway, agregamos el prefix aquí
  const useApiGateway = configService.get<boolean>('USE_API_GATEWAY', false);
  
  if (!useApiGateway) {
    app.setGlobalPrefix('api/triage');
    logger.log('🔧 Running WITHOUT API Gateway - Prefix: /api/triage');
  } else {
    logger.log('🔧 Running WITH API Gateway - No prefix needed');
  }
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  
  app.enableCors({
    origin: corsOrigin.split(','), 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Internal-Request',
    ],
  });

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
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 3001);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  await app.listen(port);

  logger.log(`🚀 ASCLEPIO Triage Server running on port ${port}`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`📊 Health check: http://localhost:${port}/health`);
  logger.log(`🔌 WebSocket: ws://localhost:${port}`);
  logger.log(`📡 GraphQL: http://localhost:${port}/graphql`);
}

bootstrap();