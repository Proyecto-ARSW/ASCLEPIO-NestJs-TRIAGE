// src/modules/turnos/controllers/turno.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TurnoService } from '../services/turno.service';
import { CrearTurnoUrgenciaDto } from '../dto/crear-turno-urgencia.dto';
import { ActualizarEstadoTurnoDto } from '../dto/actualizar-estado-turno.dto';
import { LlamarPacienteDto } from '../dto/llamar-paciente.dto';
import { FinalizarTurnoDto } from '../dto/finalizar-turno.dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { EstadoTurno } from '../entities/turno.entity';

@ApiTags('Turnos')
@ApiBearerAuth('JWT-auth')
@Controller('turnos')
@UseGuards(AuthGuard, RolesGuard)
export class TurnoController {
  constructor(private readonly turnoService: TurnoService) {}

  @Post()
  @Roles('RECEPCIONISTA', 'ADMIN', 'ENFERMERO')
  @ApiOperation({ summary: 'Crear turno de urgencia' })
  @ApiResponse({ status: 201, description: 'Turno creado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos para esta acción.' })
  async crear(@Body() dto: CrearTurnoUrgenciaDto) {
    const turno = await this.turnoService.crearTurnoUrgencia(dto);
    return {
      success: true,
      data: turno,
      mensaje: `Turno ${turno.numero_turno} creado exitosamente`,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener turno por ID' })
  @ApiParam({ name: 'id', description: 'ID UUID del turno' })
  @ApiResponse({ status: 200, description: 'Turno encontrado.' })
  @ApiResponse({ status: 404, description: 'Turno no encontrado.' })
  async obtenerPorId(@Param('id') id: string) {
    const turno = await this.turnoService.obtenerPorId(id);
    return { success: true, data: turno };
  }

  @Get('hospital/:hospital_id')
  @ApiOperation({ summary: 'Obtener turnos por hospital' })
  @ApiParam({ name: 'hospital_id', description: 'ID del hospital' })
  @ApiQuery({ name: 'fecha', required: false, description: 'Fecha (YYYY-MM-DD)' })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoTurno })
  @ApiResponse({ status: 200, description: 'Lista de turnos.' })
  async obtenerPorHospital(
    @Param('hospital_id') hospitalId: string,
    @Query('fecha') fecha?: string,
    @Query('estado') estado?: EstadoTurno,
  ) {
    const turnos = await this.turnoService.obtenerPorHospital(
      parseInt(hospitalId),
      fecha ? new Date(fecha) : undefined,
      estado,
    );
    return { success: true, data: turnos, total: turnos.length };
  }

  @Put(':id/estado')
  @Roles('ENFERMERO', 'MEDICO', 'ADMIN')
  @ApiOperation({ summary: 'Actualizar estado del turno' })
  @ApiParam({ name: 'id', description: 'ID UUID del turno' })
  @ApiResponse({ status: 200, description: 'Estado actualizado.' })
  async actualizarEstado(@Param('id') id: string, @Body() dto: ActualizarEstadoTurnoDto) {
    const turno = await this.turnoService.actualizarEstado(id, dto);
    return { success: true, data: turno, mensaje: 'Estado actualizado exitosamente' };
  }

  @Put(':id/llamar')
  @Roles('MEDICO')
  @ApiOperation({ summary: 'Llamar paciente a consultorio' })
  @ApiParam({ name: 'id', description: 'ID UUID del turno' })
  @ApiResponse({ status: 200, description: 'Paciente llamado exitosamente.' })
  async llamarPaciente(@Param('id') id: string, @Body() dto: LlamarPacienteDto) {
    const turno = await this.turnoService.llamarPaciente(id, dto);
    return {
      success: true,
      data: turno,
      mensaje: `Paciente del turno ${turno.numero_turno} llamado a consultorio ${dto.consultorio}`,
    };
  }

  @Put(':id/finalizar')
  @Roles('MEDICO')
  @ApiOperation({ summary: 'Finalizar turno de atención' })
  @ApiParam({ name: 'id', description: 'ID UUID del turno' })
  @ApiResponse({ status: 200, description: 'Turno finalizado.' })
  async finalizarTurno(@Param('id') id: string, @Body() dto: FinalizarTurnoDto) {
    const turno = await this.turnoService.finalizarTurno(id, dto);
    return { success: true, data: turno, mensaje: 'Turno finalizado exitosamente' };
  }

  // ─── Cancelación por el paciente (cualquier usuario autenticado) ──────────
  // Sin @Roles → RolesGuard permite paso si no hay restricción de rol definida

  @Put(':id/cancelar-paciente')
  @ApiOperation({
    summary: 'Cancelar turno (por el paciente)',
    description:
      'El paciente cancela su propio turno. Solo válido si el turno está en espera o clasificación.',
  })
  @ApiParam({ name: 'id', description: 'ID UUID del turno' })
  @ApiResponse({ status: 200, description: 'Turno cancelado.' })
  @ApiResponse({
    status: 400,
    description: 'El turno no puede cancelarse en su estado actual.',
  })
  async cancelarTurnoPaciente(@Param('id') id: string) {
    const turno = await this.turnoService.cancelarTurnoPorPaciente(id);
    return { success: true, data: turno, mensaje: 'Turno cancelado exitosamente' };
  }

  // ─── Cancelación por administración ──────────────────────────────────────

  @Delete(':id')
  @Roles('ADMIN', 'RECEPCIONISTA')
  @ApiOperation({ summary: 'Cancelar turno (administración)' })
  @ApiParam({ name: 'id', description: 'ID UUID del turno' })
  @ApiResponse({ status: 200, description: 'Turno cancelado.' })
  async cancelarTurno(@Param('id') id: string) {
    const turno = await this.turnoService.cancelarTurno(id);
    return { success: true, data: turno, mensaje: 'Turno cancelado' };
  }
}