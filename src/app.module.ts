import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { join } from 'path';

import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

// TODO: Importar módulos cuando estén creados
// import { CuestionarioModule } from './modules/cuestionario/cuestionario.module';
// import { RegistroTriageModule } from './modules/registro-triage/registro-triage.module';
// import { TurnosModule } from './modules/turnos/turnos.module';
// import { ColaModule } from './modules/cola/cola.module';
// import { AlertasModule } from './modules/alertas/alertas.module';
// import { WebsocketsModule } from './modules/websockets/websockets.module';
// import { EventosModule } from './modules/eventos/eventos.module';
// import { DashboardModule } from './modules/dashboard/dashboard.module';
// import { SharedModule } from './modules/shared/shared.module';

@Module({
  imports: [

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': true,
      },
      context: ({ req, connection }) => {

        if (req) {
          return { req };
        }

        return { connection };
      },
    }),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),

    PrismaModule,
    HealthModule,
    // SharedModule,
    // CuestionarioModule,
    // RegistroTriageModule,
    // TurnosModule,
    // ColaModule,
    // AlertasModule,
    // WebsocketsModule,
    // EventosModule,
    // DashboardModule,
  ],
})
export class AppModule {}