// src/modules/eventos/consumers/base.consumer.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { BaseEvent, ConsumeOptions } from '../interfaces/eventos.interface';

@Injectable()
export abstract class BaseConsumer implements OnModuleInit {
  protected readonly logger = new Logger(BaseConsumer.name);
  protected connection: any = null;
  protected channel: any = null;
  protected exchange: string;
  protected queue: string;

  constructor(protected configService: ConfigService) {
    this.exchange = this.configService.get<string>('rabbitmq.triageExchange') || 'triage.events';
    this.queue = this.configService.get<string>('rabbitmq.triageQueue') || 'triage.confirmado';
  }

  async onModuleInit() {
    try {
      await this.connect();
      await this.setupQueue();
      await this.startConsuming();
    } catch (error: any) {
      this.logger.error(`Error inicializando consumer: ${error?.message || error}`);
    }
  }

  /**
   * Conecta a RabbitMQ
   */
  private async connect(): Promise<void> {
    try {
      const url = this.configService.get<string>('rabbitmq.url') || 'amqp://guest:guest@localhost:5672';

      this.logger.log('Consumer conectando a RabbitMQ...');

      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Configurar exchange
      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });

      this.logger.log(`Consumer RabbitMQ conectado - Exchange: ${this.exchange}`);
    } catch (error: any) {
      this.logger.error(`Error conectando consumer RabbitMQ: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * Configura la cola y bindings
   */
  private async setupQueue() {
    if (!this.channel) {
      throw new Error('Channel no inicializado');
    }

    try {
      // Crear cola con Dead Letter Exchange
      await this.channel.assertQueue(this.queue, {
        durable: true,
        deadLetterExchange: `${this.exchange}.dlx`,
        deadLetterRoutingKey: 'dead-letter',
        arguments: {
          'x-message-ttl': 86400000,
        },
      });

      // Crear Dead Letter Queue
      const dlxQueue = `${this.queue}.dlq`;
      await this.channel.assertExchange(`${this.exchange}.dlx`, 'topic', {
        durable: true,
      });
      await this.channel.assertQueue(dlxQueue, { durable: true });
      await this.channel.bindQueue(dlxQueue, `${this.exchange}.dlx`, 'dead-letter');

      
      const routingKeys = this.getRoutingKeys();

      for (const routingKey of routingKeys) {
        await this.channel.bindQueue(this.queue, this.exchange, routingKey);
        this.logger.log(`Queue bound: ${this.queue} → ${routingKey}`);
      }
    } catch (error: any) {
      this.logger.error(`Error configurando queue: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * Inicia el consumo de mensajes
   */
  private async startConsuming() {
    if (!this.channel) {
      throw new Error('Channel no inicializado');
    }

    try {
      const options: ConsumeOptions = {
        prefetchCount: 10,
        noAck: false,
      };

      await this.channel.prefetch(options.prefetchCount);

      await this.channel.consume(
        this.queue,
        async (msg) => {
          if (!msg || !this.channel) return;

          try {
            const content = msg.content.toString();
            const event: BaseEvent = JSON.parse(content);

            this.logger.debug(`Evento recibido: ${event.event_type} - ID: ${event.event_id}`);

            await this.handleEvent(event);

            this.channel.ack(msg);

            this.logger.debug(`Evento procesado: ${event.event_type}`);
          } catch (error: any) {
            this.logger.error(
              `Error procesando mensaje: ${error?.message || error}`,
              error?.stack,
            );

            const requeue = this.shouldRequeue(error);
            if (this.channel) {
              this.channel.nack(msg, false, requeue);
            }

            if (!requeue) {
              this.logger.warn(`Mensaje enviado a Dead Letter Queue`);
            }
          }
        },
        { noAck: options.noAck },
      );

      this.logger.log(`Consumiendo mensajes de: ${this.queue}`);
    } catch (error: any) {
      this.logger.error(`Error iniciando consumer: ${error?.message || error}`);
      throw error;
    }
  }

  protected abstract getRoutingKeys(): string[];

  protected abstract handleEvent(event: BaseEvent): Promise<void>;

  protected shouldRequeue(error: any): boolean {
    const transientErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];

    if (transientErrors.some((err) => error?.message?.includes(err))) {
      return true;
    }

    return false;
  }
}