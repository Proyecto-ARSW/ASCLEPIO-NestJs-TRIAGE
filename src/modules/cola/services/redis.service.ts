// src/modules/cola/services/redis.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisConfig = {
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      db: this.configService.get<number>('redis.db'),
      password: this.configService.get<string>('redis.password'),
      keyPrefix: this.configService.get<string>('redis.keyPrefix'),
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    this.logger.log('Conectando a Redis...');
    
    this.client = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);

    this.client.on('connect', () => {
      this.logger.log('Redis client conectado');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis client error:', error);
    });

    this.subscriber.on('connect', () => {
      this.logger.log('Redis subscriber conectado');
    });

    await this.client.ping();
    this.logger.log('Redis listo');
  }

  async onModuleDestroy() {
    this.logger.log('Desconectando de Redis...');
    await this.client.quit();
    await this.subscriber.quit();
    this.logger.log('Redis desconectado');
  }

  getClient(): Redis {
    return this.client;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }


  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.client.zrem(key, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrange(key, start, stop);
  }

  async zrangeWithScores(
    key: string,
    start: number,
    stop: number,
  ): Promise<{ member: string; score: number }[]> {
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
    return this.client.zcard(key);
  }

  async zrank(key: string, member: string): Promise<number | null> {
    return this.client.zrank(key, member);
  }

  async zcount(key: string, min: number | string, max: number | string): Promise<number> {
    return this.client.zcount(key, min, max);
  }


  async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<{ [key: string]: string }> {
    return this.client.hgetall(key);
  }

  async hmset(key: string, data: { [key: string]: string }): Promise<'OK'> {
    return this.client.hmset(key, data);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields);
  }

  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.client.set(key, value, 'EX', ttl);
    }
    return this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }


  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        callback(msg);
      }
    });
  }


  pipeline() {
    return this.client.pipeline();
  }


  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async exists(...keys: string[]): Promise<number> {
    return this.client.exists(...keys);
  }
}