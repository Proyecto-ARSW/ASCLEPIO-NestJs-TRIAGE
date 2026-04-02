// src/modules/cuestionario/controllers/cuestionario.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { CuestionarioTriageService } from '../services/cuestionario-triage.service';
import { EvaluarCuestionarioDto } from '../dto/evaluar-cuestionario.dto';
import { AuthGuard } from '@/common/guards/auth.guard';

@Controller('cuestionario')
export class CuestionarioController {
  private readonly logger = new Logger(CuestionarioController.name);

  constructor(
    private readonly cuestionarioService: CuestionarioTriageService,
  ) {}

  /**
   * POST /api/triage/cuestionario/evaluar
   * Evalúa el cuestionario llenado por el paciente
   */
  @Post('evaluar')
  async evaluar(@Body() dto: EvaluarCuestionarioDto) {
    this.logger.log(
      `Nueva evaluación de cuestionario - Turno: ${dto.turno_id}`,
    );

    const resultado = await this.cuestionarioService.evaluarCuestionario(dto);

    return {
      success: true,
      data: resultado,
    };
  }

  /**
   * GET /api/triage/cuestionario/:id
   * Obtiene un cuestionario por ID
   */
  @Get(':id')
  @UseGuards(AuthGuard)
  async obtenerPorId(@Param('id') id: string) {
    const cuestionario = await this.cuestionarioService.obtenerPorId(id);

    return {
      success: true,
      data: cuestionario,
    };
  }

  /**
   * GET /api/triage/cuestionario/turno/:turno_id
   * Obtiene el cuestionario de un turno específico
   */
  @Get('turno/:turno_id')
  @UseGuards(AuthGuard)
  async obtenerPorTurno(@Param('turno_id') turnoId: string) {
    const cuestionario = await this.cuestionarioService.obtenerPorTurno(turnoId);

    return {
      success: true,
      data: cuestionario,
    };
  }
}