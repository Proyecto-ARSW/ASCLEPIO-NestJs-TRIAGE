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
  @ApiOperation({ summary: 'Crear turno de urgencia', description: 'Crea un nuevo turno de urgencia para un paciente. Roles: RECEPCIONISTA, ADMIN, ENFERMERO.' })
  @ApiResponse({ status: 201, description: 'Turno creado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos para esta acción.' })
  async crear(@Body() dto: CrearTurnoUrgenciaDto) {
    const turno = await this.turnoService.crearTurnoUrgencia(dto);
    return { success: true, data: turno, mensaje: `Turno ${turno.numero_turno} creado exitosamente` };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener turno por ID' })
  @ApiParam({ name: 'id', description: 'ID UUID del turno', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Turno encontrado.' })
  @ApiResponse({ status: 404, description: 'Turno no encontrado.' })
  async obtenerPorId(@Param('id') id: string) {
    const turno = await this.turnoService.obtenerPorId(id);
    return { success: true, data: turno };
  }

  @Get('hospital/:hospital_id')
  @ApiOperation({ summary: 'Obtener turnos por hospital', description: 'Retorna los turnos de un hospital, con filtros opcionales por fecha y estado.' })
  @ApiParam({ name: 'hospital_id', description: 'ID del hospital', example: '1' })
  @ApiQuery({ name: 'fecha', required: false, description: 'Fecha de consulta (YYYY-MM-DD)', example: '2026-04-21' })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoTurno, description: 'Estado del turno a filtrar' })
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
  @ApiOperation({ summary: 'Actualizar estado del turno', description: 'Cambia el estado de un turno. Roles: ENFERMERO, MEDICO, ADMIN.' })
  @ApiParam({ name: 'id', description: 'ID UUID del turno', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Estado actualizado.' })
  @ApiResponse({ status: 404, description: 'Turno no encontrado.' })
  async actualizarEstado(@Param('id') id: string, @Body() dto: ActualizarEstadoTurnoDto) {
    const turno = await this.turnoService.actualizarEstado(id, dto);
    return { success: true, data: turno, mensaje: 'Estado actualizado exitosamente' };
  }

  @Put(':id/llamar')
  @Roles('MEDICO')
  @ApiOperation({ summary: 'Llamar paciente a consultorio', description: 'El médico llama al paciente para atención. Rol: MEDICO.' })
  @ApiParam({ name: 'id', description: 'ID UUID del turno', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Paciente llamado exitosamente.' })
  async llamarPaciente(@Param('id') id: string, @Body() dto: LlamarPacienteDto) {
    const turno = await this.turnoService.llamarPaciente(id, dto);
    return { success: true, data: turno, mensaje: `Paciente del turno ${turno.numero_turno} llamado a consultorio ${dto.consultorio}` };
  }

  @Put(':id/finalizar')
  @Roles('MEDICO')
  @ApiOperation({ summary: 'Finalizar turno de atención', description: 'El médico registra diagnóstico y tratamiento para cerrar el turno. Rol: MEDICO.' })
  @ApiParam({ name: 'id', description: 'ID UUID del turno', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Turno finalizado.' })
  async finalizarTurno(@Param('id') id: string, @Body() dto: FinalizarTurnoDto) {
    const turno = await this.turnoService.finalizarTurno(id, dto);
    return { success: true, data: turno, mensaje: 'Turno finalizado exitosamente' };
  }

  @Delete(':id')
  @Roles('ADMIN', 'RECEPCIONISTA')
  @ApiOperation({ summary: 'Cancelar turno', description: 'Cancela un turno activo. Roles: ADMIN, RECEPCIONISTA.' })
  @ApiParam({ name: 'id', description: 'ID UUID del turno', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Turno cancelado.' })
  async cancelarTurno(@Param('id') id: string) {
    const turno = await this.turnoService.cancelarTurno(id);
    return { success: true, data: turno, mensaje: 'Turno cancelado' };
  }
}
