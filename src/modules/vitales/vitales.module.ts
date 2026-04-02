// src/modules/vitales/vitales.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VitalesService } from './services/vitales.service';
import { ClassifierGatewayService } from './services/classifier-gateway.service';
import { VitalesController } from './controllers/vitales.controller';
import { TurnosModule } from '../turnos/turnos.module';
import { CuestionarioModule } from '../cuestionario/cuestionario.module';

@Module({
  imports: [
    HttpModule,
    TurnosModule,
    CuestionarioModule,
  ],
  controllers: [VitalesController],
  providers: [VitalesService, ClassifierGatewayService],
  exports: [VitalesService],
})
export class VitalesModule {}