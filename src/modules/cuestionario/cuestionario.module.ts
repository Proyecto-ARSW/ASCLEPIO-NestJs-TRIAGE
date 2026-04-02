// src/modules/cuestionario/cuestionario.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CuestionarioTriageService } from './services/cuestionario-triage.service';
import { OllamaGatewayService } from './services/ollama-gateway.service';
import { CuestionarioController } from './controllers/cuestionario.controller';
import { TurnosModule } from '../turnos/turnos.module';

@Module({
  imports: [
    HttpModule,
    TurnosModule,
  ],
  controllers: [CuestionarioController],
  providers: [CuestionarioTriageService, OllamaGatewayService],
  exports: [CuestionarioTriageService],
})
export class CuestionarioModule {}