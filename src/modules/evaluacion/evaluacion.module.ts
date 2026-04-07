// src/modules/cuestionario/cuestionario.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EvaluacionService } from './services/evaluacion.service';
import { EvaluacionController } from './controllers/evaluacion.controller';
import { TurnosModule } from '../turnos/turnos.module';

@Module({
  imports: [
    HttpModule,
    TurnosModule,
  ],
  controllers: [EvaluacionController],
  providers: [EvaluacionService],
  exports: [EvaluacionService],
})
export class EvaluacionModule {}