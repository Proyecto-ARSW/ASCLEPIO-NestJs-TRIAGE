// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ScheduleModule } from '@nestjs/schedule';

// Configuraciones
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import rabbitmqConfig from './config/rabbitmq.config';

// Módulos core
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

// Módulos de feature
import { SharedModule } from './modules/shared/shared.module';
import { ColaModule } from './modules/cola/cola.module';
import { EventosModule } from './modules/eventos/eventos.module';
import { WebsocketsModule } from './modules/websockets/websockets.module';
import { TurnosModule } from './modules/turnos/turnos.module';
import { EvaluacionModule } from './modules/evaluacion/evaluacion.module';
import { VitalesModule } from './modules/vitales/vitales.module';
import { ConfirmacionModule } from './modules/confirmacion/confirmacion.module';
import { AlertasModule } from './modules/alertas/alertas.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, databaseConfig, redisConfig, rabbitmqConfig],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true, 
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': true, 
      },
      context: ({ req, connection }) => {
        if (req) {
          return { req };
        }
        if (connection) {
          return { req: connection.context };
        }
      },
    }),

    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),

    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    
    // Módulos globales (marcados con @Global())
    SharedModule,       // Entidades compartidas GraphQL
    ColaModule,         // Cola priorizada Redis + Pub/Sub
    EventosModule,      // RabbitMQ publishers + consumers
    WebsocketsModule,   // Socket.IO gateway

    // Módulos de dominio
    TurnosModule,       // Gestión de turnos
    EvaluacionModule, // Cuestionarios + IA preliminar (Ollama)
    VitalesModule,      // Signos vitales + IA clasificación (Random Forest)
    ConfirmacionModule, // Confirmación enfermero + métricas IA
    AlertasModule,      // Alertas críticas + GraphQL Subscriptions
    TasksModule,        // Cron jobs (escalamiento automático)
    DashboardModule,    // 6 dashboards especializados
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}