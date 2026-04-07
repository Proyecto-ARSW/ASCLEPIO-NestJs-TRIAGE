// src/modules/vitales/vitales.controller.ts

import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { VitalesService } from './vitales.service';
import { RegistrarVitalesDto } from './dto/registrar-vitales.dto';

@Controller('vitales')
export class VitalesController {
  constructor(private readonly vitalesService: VitalesService) {}

  /**
   * Registrar signos vitales
   * POST /api/triage/vitales/registrar
   */
  @Post('registrar')
  async registrarVitales(@Body() dto: RegistrarVitalesDto) {
    return this.vitalesService.registrarVitales(dto);
  }

  /**
   * Obtener registro de vitales por ID
   * GET /api/triage/vitales/:id
   */
  @Get(':id')
  async obtenerRegistro(@Param('id') id: string) {
    return this.vitalesService.obtenerRegistro(id);
  }

  /**
   * Obtener registro por turno_id
   * GET /api/triage/vitales/turno/:turno_id
   */
  @Get('turno/:turno_id')
  async obtenerRegistroPorTurno(@Param('turno_id') turno_id: string) {
    return this.vitalesService.obtenerRegistroPorTurno(turno_id);
  }
}