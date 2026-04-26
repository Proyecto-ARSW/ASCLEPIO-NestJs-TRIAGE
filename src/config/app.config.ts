// src/config/app.config.ts

import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  useApiGateway: process.env.USE_API_GATEWAY === 'true',
  apiGatewayUrl: process.env.API_GATEWAY_URL || 'http://localhost',

  ollamaPrelimUrl: process.env.OLLAMA_PRELIM_URL || 'http://localhost:3002',
  triageClassifierUrl: process.env.TRIAGE_CLASSIFIER_URL || 'http://localhost:3003',
  coreApiUrl: process.env.CORE_API_URL || 'http://localhost:3000',

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION || '1d',
}));