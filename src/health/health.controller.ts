// src/health/health.controller.ts

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckError,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { parse } from 'node:path';
import { PrismaService } from '../modules/prisma/prisma.service';
import { RedisService } from '../modules/cola/services/redis.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const client = this.redisService.getClient();
      if (!client) {
        throw new Error('Cliente no inicializado');
      }
      const result = await client.ping();
      if (result !== 'PONG') throw new Error('Respuesta inesperada');
      return { redis: { status: 'up' } };
    } catch (err: any) {
      throw new HealthCheckError('redis', {
        redis: { status: 'down', message: err?.message ?? 'Sin conexión' },
      });
    }
  }

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check completo',
    description: 'Verifica el estado de la base de datos, Redis, memoria heap y disco.',
  })
  @ApiResponse({ status: 200, description: 'Servicio y dependencias saludables.' })
  @ApiResponse({ status: 503, description: 'Una o más dependencias no están disponibles.' })
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.checkRedis(),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.disk.checkStorage('disk', { path: parse(process.cwd()).root, thresholdPercent: 0.9 }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Verifica si el servicio está listo para recibir tráfico (BD + Redis).',
  })
  @ApiResponse({ status: 200, description: 'Servicio listo.' })
  @ApiResponse({ status: 503, description: 'Servicio no listo.' })
  ready() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.checkRedis(),
    ]);
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Confirma que el proceso está vivo. Usado por Kubernetes/Docker.',
  })
  @ApiResponse({ status: 200, description: 'Servicio vivo.' })
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'asclepio-triage',
      version: process.env.npm_package_version || '1.0.0',
    };
  }
}
