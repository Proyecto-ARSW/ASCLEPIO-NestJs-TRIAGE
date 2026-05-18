// src/health/rabbitmq.health.ts

import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { TriageEventPublisher } from '../modules/eventos/publishers/triage-event.publisher';

@Injectable()
export class RabbitMQHealthIndicator extends HealthIndicator {
  constructor(private readonly publisher: TriageEventPublisher) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const connected = this.publisher.isConnected();
    const result = this.getStatus(key, connected);

    if (connected) {
      return result;
    }

    throw new HealthCheckError('rabbitmq', result);
  }
}