// src/health/health.module.ts

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { ColaModule } from '../modules/cola/cola.module';

@Module({
  imports: [TerminusModule, ColaModule],
  controllers: [HealthController],
})
export class HealthModule {}
