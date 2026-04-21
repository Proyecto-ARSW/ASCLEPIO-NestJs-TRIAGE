// src/modules/cola/cola.module.ts

import { Module, Global } from '@nestjs/common';
import { ColaService } from './services/cola.service';
import { RedisService } from './services/redis.service';

@Global()
@Module({
  providers: [RedisService, ColaService],
  exports: [RedisService, ColaService],
})
export class ColaModule {}