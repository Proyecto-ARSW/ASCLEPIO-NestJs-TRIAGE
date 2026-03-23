// src/config/websocket.config.ts

import { registerAs } from '@nestjs/config';

export default registerAs('websocket', () => ({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
  namespace: '/triage',
}));