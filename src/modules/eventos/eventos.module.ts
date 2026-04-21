// src/modules/eventos/eventos.module.ts

import { Module, Global } from '@nestjs/common';
import { TriageEventPublisher } from './publishers/triage-event.publisher';

@Global()
@Module({
  providers: [TriageEventPublisher],
  exports: [TriageEventPublisher],
})
export class EventosModule {}
