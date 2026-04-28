// src/health/health.controller.ts

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  HealthIndicatorService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { parse } from 'node:path';
import { PrismaService } from '../modules/prisma/prisma.service';
import { RedisService } from '../modules/cola/services/redis.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private async checkRedis(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check('redis');
    const client = this.redisService.getClient();

    if (!client) {
      return indicator.down({ message: 'Cliente no inicializado' });
    }

    if (client.status !== 'ready') {
      return indicator.down({ message: `Estado de conexión: ${client.status}` });
    }

    try {
      const result = await client.ping();
      if (result !== 'PONG') {
        return indicator.down({ message: 'Respuesta inesperada' });
      }

      return indicator.up();
    } catch (err: any) {
      return indicator.down({ message: err?.message ?? 'Sin conexión' });
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
