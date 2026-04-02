// src/modules/alertas/alertas.module.ts

import { Module } from '@nestjs/common';
import { AlertaCriticaService } from './services/alerta-critica.service';
import { AlertaTriageService } from './services/alerta-triage.service';
import { EscalamientoService } from './services/escalamiento.service';
import { AlertaResolver } from './resolvers/alerta.resolver';
import { AlertaController } from './controllers/alerta.controller';
import { ColaModule } from '../cola/cola.module';

@Module({
  imports: [ColaModule],
  controllers: [AlertaController],
  providers: [
    AlertaCriticaService,
    AlertaTriageService,
    EscalamientoService,
    AlertaResolver,
  ],
  exports: [
    AlertaCriticaService,
    AlertaTriageService,
    EscalamientoService,
  ],
})
export class AlertasModule {}