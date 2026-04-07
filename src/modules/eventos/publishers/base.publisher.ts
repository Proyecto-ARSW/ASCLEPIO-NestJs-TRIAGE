// src/modules/eventos/publishers/base.publisher.ts

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { BaseEvent, PublishOptions } from '../interfaces/eventos.interface';

@Injectable()
export class BasePublisher implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(BasePublisher.name);
  protected connection: any = null;
  protected channel: any = null;
  protected exchange: string;

  constructor(protected configService: ConfigService) {
    this.exchange = this.configService.get<string>('rabbitmq.triageExchange') || 'triage.events';
  }

  async onModuleInit() {
    try {
      await this.connect();
    } catch (error: any) {
      this.logger.error(`Error inicializando publisher: ${error?.message || error}`);
      // No lanzar error para permitir que el módulo arranque sin RabbitMQ
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Conecta a RabbitMQ
   */
  private async connect() {
    try {
      const url = this.configService.get<string>('rabbitmq.url') || 'amqp://guest:guest@localhost:5672';

      this.logger.log('Publisher conectando a RabbitMQ...');

      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Configurar exchange (Topic Exchange para routing por evento)
      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });

      this.logger.log(`Publisher RabbitMQ conectado - Exchange: ${this.exchange}`);

      // Manejar errores de conexión
      this.connection.on('error', (error) => {
        this.logger.error(`RabbitMQ connection error: ${error.message}`);
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
      });
    } catch (error: any) {
      this.logger.error(`Error conectando a RabbitMQ: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * Desconecta de RabbitMQ
   */
  private async disconnect() {
    try {
      this.logger.log('Desconectando de RabbitMQ...');

      if (this.channel) {
        await this.channel.close();
      }

      if (this.connection) {
        await this.connection.close();
      }

      this.logger.log('RabbitMQ desconectado');
    } catch (error: any) {
      this.logger.error(`Error desconectando RabbitMQ: ${error?.message || error}`);
    }
  }

  /**
   * Publica un evento
   */
  protected async publish<T>(
    eventType: string,
    payload: T,
    options?: PublishOptions,
  ): Promise<void> {
    if (!this.channel) {
      this.logger.warn(`Canal no disponible, evento no publicado: ${eventType}`);
      return;
    }

    try {
      const correlationId = uuidv4();

      const event: BaseEvent<T> = {
        event_type: eventType,
        event_id: uuidv4(),
        timestamp: new Date().toISOString(),
        service: 'asclepio-triage',
        version: '1.0.0',
        payload,
        metadata: {
          correlation_id: correlationId,
        },
      };

      const message = Buffer.from(JSON.stringify(event));

      const publishOptions: amqp.Options.Publish = {
        persistent: options?.persistent ?? true,
        expiration: options?.expiration,
        priority: options?.priority,
        correlationId: correlationId,
        timestamp: Date.now(),
        contentType: 'application/json',
      };

      const published = this.channel.publish(
        this.exchange,
        eventType,
        message,
        publishOptions,
      );

      if (published) {
        this.logger.debug(`Evento publicado: ${eventType} - ID: ${event.event_id}`);
      } else {
        this.logger.warn(`Evento no pudo ser publicado (buffer lleno): ${eventType}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Error publicando evento ${eventType}: ${error?.message || error}`,
        error?.stack,
      );
      throw error;
    }
  }

  /**
   * Verifica si el publisher está conectado
   */
  isConnected(): boolean {
    return this.channel !== null && this.connection !== null;
  }
}