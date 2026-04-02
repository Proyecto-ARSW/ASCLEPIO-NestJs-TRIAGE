// src/modules/confirmacion/confirmacion.module.ts

import { Module } from '@nestjs/common';
import { ConfirmacionService } from './services/confirmacion.service';
import { MetricasIAService } from './services/metricas-ia.service';
import { ConfirmacionController } from './controllers/confirmacion.controller';
import { TurnosModule } from '../turnos/turnos.module';
import { VitalesModule } from '../vitales/vitales.module';
import { ColaModule } from '../cola/cola.module'; 

@Module({
  imports: [
    TurnosModule,
    VitalesModule,
    ColaModule, 
  ],
  controllers: [ConfirmacionController],
  providers: [ConfirmacionService, MetricasIAService],
  exports: [ConfirmacionService, MetricasIAService],
})
export class ConfirmacionModule {}