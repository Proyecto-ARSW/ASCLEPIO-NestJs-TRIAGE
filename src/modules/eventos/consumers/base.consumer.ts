// src/modules/eventos/consumers/base.consumer.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { BaseEvent, ConsumeOptions } from '../interfaces/eventos.interface';

@Injectable()
export abstract class BaseConsumer implements OnModuleInit {
  protected readonly logger = new Logger(BaseConsumer.name);
  protected connection: amqp.Connection;
  protected channel: amqp.Channel;
  protected exchange: string;
  protected queue: string;

  constructor(protected configService: ConfigService) {
    this.exchange = this.configService.get<string>('rabbitmq.exchange');
    this.queue = this.configService.get<string>('rabbitmq.queue');
  }

  async onModuleInit() {
    await this.connect();
    await this.setupQueue();
    await this.startConsuming();
  }

  /**
   * Conecta a RabbitMQ
   */
  private async connect() {
    try {
      const url = this.configService.get<string>('rabbitmq.url');
      
      this.logger.log('🔌 Consumer conectando a RabbitMQ...');
      
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Configurar exchange
      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });

      this.logger.log(`Consumer RabbitMQ conectado - Exchange: ${this.exchange}`);
    } catch (error) {
      this.logger.error(`Error conectando consumer RabbitMQ: ${error.message}`);
      throw error;
    }
  }

  /**
   * Configura la cola y bindings
   */
  private async setupQueue() {
    try {
      // Crear cola con Dead Letter Exchange
      await this.channel.assertQueue(this.queue, {
        durable: true,
        deadLetterExchange: `${this.exchange}.dlx`,
        deadLetterRoutingKey: 'dead-letter',
        arguments: {
          'x-message-ttl': 86400000, // 24 horas
        },
      });

      // Crear Dead Letter Queue
      const dlxQueue = `${this.queue}.dlq`;
      await this.channel.assertExchange(`${this.exchange}.dlx`, 'topic', {
        durable: true,
      });
      await this.channel.assertQueue(dlxQueue, { durable: true });
      await this.channel.bindQueue(dlxQueue, `${this.exchange}.dlx`, 'dead-letter');

      // Bindings: Qué eventos escuchar
      const routingKeys = this.getRoutingKeys();
      
      for (const routingKey of routingKeys) {
        await this.channel.bindQueue(this.queue, this.exchange, routingKey);
        this.logger.log(`Queue bound: ${this.queue} → ${routingKey}`);
      }
    } catch (error) {
      this.logger.error(`Error configurando queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inicia el consumo de mensajes
   */
  private async startConsuming() {
    try {
      const options: ConsumeOptions = {
        prefetchCount: 10, // Procesar máximo 10 mensajes a la vez
        noAck: false, // Requiere ACK manual
      };

      await this.channel.prefetch(options.prefetchCount);

      await this.channel.consume(
        this.queue,
        async (msg) => {
          if (!msg) return;

          try {
            const content = msg.content.toString();
            const event: BaseEvent = JSON.parse(content);

            this.logger.debug(
              `Evento recibido: ${event.event_type} - ID: ${event.event_id}`,
            );

            // Procesar evento (implementado por subclases)
            await this.handleEvent(event);

            // ACK: Mensaje procesado exitosamente
            this.channel.ack(msg);

            this.logger.debug(`Evento procesado: ${event.event_type}`);
          } catch (error) {
            this.logger.error(
              `❌ Error procesando mensaje: ${error.message}`,
              error.stack,
            );

            // NACK: Reintentar o enviar a DLQ
            const requeue = this.shouldRequeue(error);
            this.channel.nack(msg, false, requeue);

            if (!requeue) {
              this.logger.warn(`Mensaje enviado a Dead Letter Queue`);
            }
          }
        },
        { noAck: options.noAck },
      );

      this.logger.log(`Consumiendo mensajes de: ${this.queue}`);
    } catch (error) {
      this.logger.error(`Error iniciando consumer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Define qué routing keys escuchar (implementado por subclases)
   */
  protected abstract getRoutingKeys(): string[];

  /**
   * Maneja un evento recibido (implementado por subclases)
   */
  protected abstract handleEvent(event: BaseEvent): Promise<void>;

  /**
   * Decide si reintentar un mensaje fallido
   */
  protected shouldRequeue(error: any): boolean {
    // Errores transitorios → Requeue
    // Errores de validación/lógica → No requeue (DLQ)
    
    const transientErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
    
    if (transientErrors.some(err => error.message.includes(err))) {
      return true; // Reintentar
    }

    return false; // Enviar a DLQ
  }
}