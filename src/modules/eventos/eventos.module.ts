// src/modules/eventos/eventos.module.ts

import { Module, Global } from '@nestjs/common';
import { TriageEventPublisher } from './publishers/triage-event.publisher';
import { CoreEventConsumer } from './consumers/core-event.consumer';

@Global()
@Module({
  providers: [
    TriageEventPublisher,
    CoreEventConsumer,
  ],
  exports: [TriageEventPublisher],
})
export class EventosModule {}