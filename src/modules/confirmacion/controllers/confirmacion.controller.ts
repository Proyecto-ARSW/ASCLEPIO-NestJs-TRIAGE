// src/modules/confirmacion/confirmacion.controller.ts

import { Controller, Post, Get, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { ConfirmacionService } from './confirmacion.service';
import { ConfirmarTriageDto } from './dto/confirmar-triage.dto';

@Controller('confirmaciones')
export class ConfirmacionController {
  constructor(private readonly confirmacionService: ConfirmacionService) {}

  /**
   * Confirmar nivel de triage
   * POST /api/triage/confirmaciones/confirmar
   */
  @Post('confirmar')
  async confirmarTriage(@Body() dto: ConfirmarTriageDto) {
    return this.confirmacionService.confirmarTriage(dto);
  }

  /**
   * Obtener confirmación por ID
   * GET /api/triage/confirmaciones/:id
   */
  @Get(':id')
  async obtenerConfirmacion(@Param('id') id: string) {
    return this.confirmacionService.obtenerConfirmacion(id);
  }

  /**
   * Obtener confirmaciones por enfermero
   * GET /api/triage/confirmaciones/enfermero/:enfermero_id
   */
  @Get('enfermero/:enfermero_id')
  async obtenerConfirmacionesPorEnfermero(
    @Param('enfermero_id') enfermero_id: string,
    @Query('limit', ParseIntPipe) limit: number = 50
  ) {
    return this.confirmacionService.obtenerConfirmacionesPorEnfermero(enfermero_id, limit);
  }
}