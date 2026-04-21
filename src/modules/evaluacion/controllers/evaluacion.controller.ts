// src/modules/evaluacion/evaluacion.controller.ts

import { Controller, Post, Get, Param, Body, HttpCode, Query, ParseIntPipe } from '@nestjs/common';
import { EvaluacionService } from '../services/evaluacion.service';
import { GuardarEvaluacionDto } from '../dto/guardar-evaluacion.dto';

@Controller('evaluaciones')
export class EvaluacionController {
  constructor(private readonly evaluacionService: EvaluacionService) {}

  /**
   * Webhook que Ollama llama cuando termina de procesar
   * POST /api/triage/evaluaciones/webhook
   */
  @Post('webhook')
  @HttpCode(200)
  async recibirEvaluacionDeOllama(@Body() dto: GuardarEvaluacionDto) {
    return this.evaluacionService.guardarEvaluacionPreliminar(dto);
  }

  /**
   * Obtener evaluación por ID
   * GET /api/triage/evaluaciones/:id
   */
  @Get(':id')
  async obtenerEvaluacion(@Param('id') id: string) {
    return this.evaluacionService.obtenerEvaluacion(id);
  }

  /**
   * Obtener evaluación por turno_id
   * GET /api/triage/evaluaciones/turno/:turno_id
   */
  @Get('turno/:turno_id')
  async obtenerEvaluacionPorTurno(@Param('turno_id') turno_id: string) {
    return this.evaluacionService.obtenerEvaluacionPorTurno(turno_id);
  }

  /**
   * Obtener evaluaciones pendientes (esperando vitales)
   * GET /api/triage/evaluaciones/hospital/:hospital_id/pendientes
   */
  @Get('hospital/:hospital_id/pendientes')
  async obtenerEvaluacionesPendientes(
    @Param('hospital_id', ParseIntPipe) hospital_id: number
  ) {
    return this.evaluacionService.obtenerEvaluacionesPendientes(hospital_id);
  }
}