// src/modules/confirmacion/controllers/confirmacion.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ConfirmacionService } from '../services/confirmacion.service';
import { MetricasIAService } from '../services/metricas-ia.service';
import { ConfirmarTriageDto } from '../dto/confirmar-triage.dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('confirmacion')
@UseGuards(AuthGuard, RolesGuard)
export class ConfirmacionController {
  private readonly logger = new Logger(ConfirmacionController.name);

  constructor(
    private readonly confirmacionService: ConfirmacionService,
    private readonly metricasService: MetricasIAService,
  ) {}

  /**
   * POST /api/triage/confirmacion/confirmar
   * Confirma o ajusta el nivel de triage
   */
  @Post('confirmar')
  @Roles('ENFERMERO')
  async confirmar(@Body() dto: ConfirmarTriageDto) {
    this.logger.log(
      `Confirmación de triage - Turno: ${dto.turno_id} - Nivel: ${dto.nivel_final_enfermero}`,
    );

    const resultado = await this.confirmacionService.confirmarTriage(dto);

    return {
      success: true,
      data: resultado,
    };
  }

  /**
   * GET /api/triage/confirmacion/:id
   * Obtiene una confirmación por ID
   */
  @Get(':id')
  @Roles('ENFERMERO', 'ADMIN')
  async obtenerPorId(@Param('id') id: string) {
    const confirmacion = await this.confirmacionService.obtenerPorId(id);

    return {
      success: true,
      data: confirmacion,
    };
  }

  /**
   * GET /api/triage/confirmacion/enfermero/:enfermero_id
   * Obtiene confirmaciones de un enfermero
   */
  @Get('enfermero/:enfermero_id')
  @Roles('ENFERMERO', 'ADMIN')
  async obtenerPorEnfermero(
    @Param('enfermero_id') enfermeroId: string,
    @Query('limite') limite?: string,
  ) {
    const confirmaciones = await this.confirmacionService.obtenerPorEnfermero(
      enfermeroId,
      limite ? parseInt(limite) : 50,
    );

    return {
      success: true,
      data: confirmaciones,
      total: confirmaciones.length,
    };
  }

  /**
   * GET /api/triage/confirmacion/metricas/ia
   * Obtiene métricas de precisión del sistema de IA
   */
  @Get('metricas/ia')
  @Roles('ADMIN', 'JEFE_GUARDIA')
  async obtenerMetricasIA(
    @Query('hospital_id') hospitalId?: string,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
  ) {
    const metricas = await this.metricasService.calcularMetricasIA(
      hospitalId ? parseInt(hospitalId) : undefined,
      fechaInicio ? new Date(fechaInicio) : undefined,
      fechaFin ? new Date(fechaFin) : undefined,
    );

    return {
      success: true,
      data: metricas,
    };
  }

  /**
   * GET /api/triage/confirmacion/metricas/enfermero/:enfermero_id
   * Obtiene métricas de un enfermero
   */
  @Get('metricas/enfermero/:enfermero_id')
  @Roles('ENFERMERO', 'ADMIN', 'JEFE_GUARDIA')
  async obtenerMetricasEnfermero(
    @Param('enfermero_id') enfermeroId: string,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
  ) {
    const metricas = await this.metricasService.calcularMetricasEnfermero(
      enfermeroId,
      fechaInicio ? new Date(fechaInicio) : undefined,
      fechaFin ? new Date(fechaFin) : undefined,
    );

    return {
      success: true,
      data: metricas,
    };
  }
}