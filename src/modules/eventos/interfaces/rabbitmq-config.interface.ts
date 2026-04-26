// src/modules/eventos/interfaces/rabbitmq-config.interface.ts

export interface RabbitMQConfig {
  url: string;
  exchange: string;
  queue: string;
  queues?: {
    triage: string;
    deadLetter: string;
  };
}

export interface PublishOptions {
  persistent?: boolean;
  expiration?: string;
  priority?: number;
  correlationId?: string;
}

export interface ConsumeOptions {
  prefetchCount?: number;
  noAck?: boolean;
}