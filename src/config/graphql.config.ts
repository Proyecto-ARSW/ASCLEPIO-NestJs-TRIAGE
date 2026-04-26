// src/config/graphql.config.ts

import { registerAs } from '@nestjs/config';

export default registerAs('graphql', () => ({
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
  debug: process.env.NODE_ENV === 'development',
}));