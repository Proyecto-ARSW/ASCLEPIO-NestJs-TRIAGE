// src/modules/confirmacion/confirmacion.controller.ts

import { Controller, Post, Get, Param, Body, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ConfirmacionService } from '../services/confirmacion.service';
import { ConfirmarTriageDto } from '../dto/confirmar-triage.dto';

@ApiTags('Confirmaciones')
@ApiBearerAuth('JWT-auth')
@Controller('confirmaciones')
export class ConfirmacionController {
  constructor(private readonly confirmacionService: ConfirmacionService) {}

  @Post('confirmar')
  @ApiOperation({ summary: 'Confirmar nivel de triage', description: 'El enfermero confirma o ajusta el nivel de triage sugerido por la IA.' })
  @ApiResponse({ status: 201, description: 'Nivel de triage confirmado.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  async confirmarTriage(@Body() dto: ConfirmarTriageDto) {
    return this.confirmacionService.confirmarTriage(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener confirmación por ID' })
  @ApiParam({ name: 'id', description: 'ID UUID de la confirmación', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Confirmación encontrada.' })
  @ApiResponse({ status: 404, description: 'Confirmación no encontrada.' })
  async obtenerConfirmacion(@Param('id') id: string) {
    return this.confirmacionService.obtenerConfirmacion(id);
  }

  @Get('hospital/:hospital_id/resumen')
  @ApiOperation({ summary: 'Resumen de confirmaciones del hospital hoy' })
  @ApiParam({ name: 'hospital_id', description: 'ID del hospital', example: '1' })
  @ApiResponse({ status: 200, description: 'Pendientes y confirmadas hoy.' })
  async resumenHospital(@Param('hospital_id', ParseIntPipe) hospitalId: number) {
    return this.confirmacionService.resumenPorHospital(hospitalId);
  }

  @Get('enfermero/:enfermero_id')
  @ApiOperation({ summary: 'Obtener confirmaciones por enfermero', description: 'Retorna el historial de confirmaciones realizadas por un enfermero.' })
  @ApiParam({ name: 'enfermero_id', description: 'ID UUID del enfermero', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  @ApiQuery({ name: 'limit', required: false, description: 'Número máximo de resultados (default: 50)', example: 50 })
  @ApiResponse({ status: 200, description: 'Lista de confirmaciones del enfermero.' })
  async obtenerConfirmacionesPorEnfermero(
    @Param('enfermero_id') enfermero_id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number
  ) {
    return this.confirmacionService.obtenerConfirmacionesPorEnfermero(enfermero_id, limit);
  }
}
