// src/main.ts

import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3001;
  const useApiGateway = configService.get<boolean>('app.useApiGateway') || false;

  // Prefijo global — excluye health y metrics para que sean accesibles sin prefijo
  if (!useApiGateway) {
    app.setGlobalPrefix('api/triage', {
      exclude: [
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'metrics', method: RequestMethod.GET },
      ],
    });
  }

  const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const corsOrigins = corsOriginRaw.split(',').map((o) => o.trim()).filter(Boolean);

  console.log(`[CORS] Origins permitidos: ${corsOrigins.join(', ')}`);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ASCLEPIO Triage API')
    .setDescription(
      'API REST del microservicio de triage hospitalario ASCLEPIO. ' +
      'Gestiona turnos, signos vitales, alertas críticas, evaluaciones preliminares y dashboards por rol.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT-auth',
    )
    .addTag('Turnos', 'Gestión de turnos de atención')
    .addTag('Vitales', 'Registro y consulta de signos vitales')
    .addTag('Alertas', 'Alertas críticas y escalamiento')
    .addTag('Evaluaciones', 'Evaluaciones preliminares de triage (Ollama)')
    .addTag('Confirmaciones', 'Confirmación de nivel de triage por enfermero')
    .addTag('Dashboard', 'Dashboards por rol de usuario')
    .addTag('Health', 'Estado del servicio')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  await app.listen(port);

  console.log(`asclepio-triage corriendo en http://localhost:${port}`);
  console.log(`Swagger UI en http://localhost:${port}/api/docs`);
  console.log(`Métricas disponibles en http://localhost:${port}/metrics`);
  console.log(`Health check en http://localhost:${port}/health`);
  console.log(`GraphQL Playground en http://localhost:${port}/graphql`);
}

bootstrap();
