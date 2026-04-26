// src/config/redis.config.ts

import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  db: parseInt(process.env.REDIS_DB, 10) || 1,
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS || 'false',
  keyPrefix: 'asclepio:triage:',
}));