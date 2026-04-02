// src/modules/vitales/controllers/vitales.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { VitalesService } from '../services/vitales.service';
import { RegistrarVitalesDto } from '../dto/registrar-vitales.dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('vitales')
@UseGuards(AuthGuard, RolesGuard)
export class VitalesController {
  private readonly logger = new Logger(VitalesController.name);

  constructor(private readonly vitalesService: VitalesService) {}

  /**
   * POST /api/triage/vitales/registrar
   * Registra signos vitales y evalúa con Random Forest
   */
  @Post('registrar')
  @Roles('ENFERMERO')
  async registrar(@Body() dto: RegistrarVitalesDto) {
    this.logger.log(
      `Nueva toma de vitales - Turno: ${dto.turno_id}`,
    );

    const resultado = await this.vitalesService.registrarVitalesYEvaluar(dto);

    return {
      success: true,
      data: resultado,
    };
  }

  /**
   * GET /api/triage/vitales/:id
   * Obtiene un registro de triage por ID
   */
  @Get(':id')
  @Roles('ENFERMERO', 'MEDICO', 'ADMIN')
  async obtenerPorId(@Param('id') id: string) {
    const registro = await this.vitalesService.obtenerPorId(id);

    return {
      success: true,
      data: registro,
    };
  }

  /**
   * GET /api/triage/vitales/turno/:turno_id
   * Obtiene el registro de triage de un turno
   */
  @Get('turno/:turno_id')
  @Roles('ENFERMERO', 'MEDICO', 'ADMIN')
  async obtenerPorTurno(@Param('turno_id') turnoId: string) {
    const registro = await this.vitalesService.obtenerPorTurno(turnoId);

    return {
      success: true,
      data: registro,
    };
  }
}