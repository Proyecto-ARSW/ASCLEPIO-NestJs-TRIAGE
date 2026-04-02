// src/modules/turnos/turnos.module.ts

import { Module } from '@nestjs/common';
import { TurnoService } from './services/turno.service';
import { GeneradorNumeroService } from './services/generador-numero.service';
import { TurnoController } from './controllers/turno.controller';
import { ColaModule } from '../cola/cola.module';

@Module({
  imports: [ColaModule],
  controllers: [TurnoController],
  providers: [TurnoService, GeneradorNumeroService],
  exports: [TurnoService],
})
export class TurnosModule {}