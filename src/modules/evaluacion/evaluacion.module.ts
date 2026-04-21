// src/modules/evaluacion/evaluacion.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EvaluacionService } from './services/evaluacion.service';
import { EvaluacionController } from './controllers/evaluacion.controller';
import { PrismaModule } from 'src/modules/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
  ],
  controllers: [EvaluacionController],
  providers: [EvaluacionService],
  exports: [EvaluacionService],
})
export class EvaluacionModule {}