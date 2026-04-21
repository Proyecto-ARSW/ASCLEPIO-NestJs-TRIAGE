// src/modules/websockets/websockets.module.ts

import { Module, Global } from '@nestjs/common';
import { TriageGateway } from './gateways/triage.gateway';
import { ColaModule } from '../cola/cola.module';

@Global() // Hacer global para que esté disponible en todos los módulos
@Module({
  imports: [ColaModule], // Para Redis PubSub
  providers: [TriageGateway],
  exports: [TriageGateway],
})
export class WebsocketsModule {}