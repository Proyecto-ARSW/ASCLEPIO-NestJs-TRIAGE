// src/modules/cola/services/redis.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subscriber: Redis | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      const useTls = this.configService.get<string>('redis.tls') === 'true';

      const redisConfig = {
        host: this.configService.get<string>('redis.host') || 'localhost',
        port: this.configService.get<number>('redis.port') || 6379,
        db: this.configService.get<number>('redis.db') || 0,
        password: this.configService.get<string>('redis.password') || undefined,
        keyPrefix: this.configService.get<string>('redis.keyPrefix') || 'triage:',
        tls: useTls ? {} : undefined,
        retryStrategy: (times: number) => {
          if (times > 3) {
            this.logger.warn('Redis: Máximo de reintentos alcanzado');
            return null;
          }
          return Math.min(times * 50, 2000);
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      };

      this.logger.log('Conectando a Redis...');

      this.client = new Redis(redisConfig);
      this.subscriber = new Redis(redisConfig);

      this.client.on('connect', () => {
        this.logger.log('Redis client conectado');
      });

      this.client.on('error', (error: any) => {
        this.logger.error(`Redis client error: ${error?.message || error}`);
      });

      this.subscriber.on('connect', () => {
        this.logger.log('Redis subscriber conectado');
      });

      this.subscriber.on('error', (error: any) => {
        this.logger.error(`Redis subscriber error: ${error?.message || error}`);
      });

      // Intentar conectar
      await this.client.connect();
      await this.subscriber.connect();

      await this.client.ping();
      this.logger.log('Redis listo');
    } catch (error: any) {
      this.logger.error(`Error conectando a Redis: ${error?.message || error}`);
      this.logger.warn('El servicio continuará sin Redis (funcionalidad limitada)')
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log('Desconectando de Redis...');
      if (this.client) {
        await this.client.quit();
      }
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      this.logger.log('Redis desconectado');
    } catch (error: any) {
      this.logger.error(`Error desconectando Redis: ${error?.message || error}`);
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  getSubscriber(): Redis | null {
    return this.subscriber;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis no disponible, operación zadd ignorada');
      return 0;
    }
    return this.client.zadd(key, score, member);
  }

  async zrem(key: string, member: string): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis no disponible, operación zrem ignorada');
      return 0;
    }
    return this.client.zrem(key, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.client) {
      this.logger.warn('Redis no disponible, retornando array vacío');
      return [];
    }
    return this.client.zrange(key, start, stop);
  }

  async zrangeWithScores(
    key: string,
    start: number,
    stop: number,
  ): Promise<{ member: string; score: number }[]> {
    if (!this.client) {
      this.logger.warn('Redis no disponible, retornando array vacío');
      return [];
    }

    const result = await this.client.zrange(key, start, stop, 'WITHSCORES');
    const items: { member: string; score: number }[] = [];

    for (let i = 0; i < result.length; i += 2) {
      items.push({
        member: result[i],
        score: parseFloat(result[i + 1]),
      });
    }

    return items;
  }

  async zcard(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.zcard(key);
  }

  async zrank(key: string, member: string): Promise<number | null> {
    if (!this.client) return null;
    return this.client.zrank(key, member);
  }

  async zcount(key: string, min: number | string, max: number | string): Promise<number> {
    if (!this.client) return 0;
    return this.client.zcount(key, min, max);
  }


  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<{ [key: string]: string }> {
    if (!this.client) return {};
    return this.client.hgetall(key);
  }

  async hmset(key: string, data: { [key: string]: string }): Promise<'OK'> {
    if (!this.client) {
      this.logger.warn('Redis no disponible, hmset ignorado');
      return 'OK';
    }
    return this.client.hmset(key, data);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (!this.client) return 0;
    return this.client.hdel(key, ...fields);
  }


  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (!this.client) {
      this.logger.warn('Redis no disponible, set ignorado');
      return 'OK';
    }
    if (ttl) {
      return this.client.set(key, value, 'EX', ttl);
    }
    return this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async del(...keys: string[]): Promise<number> {
    if (!this.client) return 0;
    return this.client.del(...keys);
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.client) return 0;
    return this.client.expire(key, seconds);
  }


  async publish(channel: string, message: string): Promise<number> {
    if (!this.client) {
      this.logger.warn(`Redis no disponible, publish a ${channel} ignorado`);
      return 0;
    }
    return this.client.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.subscriber) {
      this.logger.warn(`Redis subscriber no disponible, subscribe a ${channel} ignorado`);
      return;
    }

    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (ch, msg) => {
        if (ch === channel) {
          callback(msg);
        }
      });
      this.logger.log(`Suscrito a canal Redis: ${channel}`);
    } catch (error: any) {
      this.logger.error(`Error suscribiéndose a ${channel}: ${error?.message || error}`);
    }
  }

    async psubscribe(pattern: string, callback: (channel: string, message: string) => void): Promise<void> {
    if (!this.subscriber) {
      this.logger.warn(`Redis subscriber no disponible, psubscribe a ${pattern} ignorado`);
      return;
    }

    try {
      await this.subscriber.psubscribe(pattern);
      this.subscriber.on('pmessage', (pat: string, ch: string, msg: string) => {
        if (pat === pattern) {
          callback(ch, msg);
        }
      });
      this.logger.log(`Suscrito a patrón Redis: ${pattern}`);
    } catch (error: any) {
      this.logger.error(`Error suscribiéndose a patrón ${pattern}: ${error?.message || error}`);
    }
  }


  pipeline() {
    if (!this.client) {
      throw new Error('Redis client no disponible');
    }
    return this.client.pipeline();
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];
    return this.client.keys(pattern);
  }

  async exists(...keys: string[]): Promise<number> {
    if (!this.client) return 0;
    return this.client.exists(...keys);
  }
}