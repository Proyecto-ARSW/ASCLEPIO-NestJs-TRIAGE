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
import { TurnoService } from '../services/turno.service';
import { CrearTurnoUrgenciaDto } from '../dto/crear-turno-urgencia.dto';
import { ActualizarEstadoTurnoDto } from '../dto/actualizar-estado-turno.dto';
import { LlamarPacienteDto } from '../dto/llamar-paciente.dto';
import { FinalizarTurnoDto } from '../dto/finalizar-turno.dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { EstadoTurno } from '../entities/turno.entity';

@Controller('turnos')
@UseGuards(AuthGuard, RolesGuard)
export class TurnoController {
  constructor(private readonly turnoService: TurnoService) {}

  @Post()
  @Roles('RECEPCIONISTA', 'ADMIN', 'ENFERMERO')
  async crear(@Body() dto: CrearTurnoUrgenciaDto) {
    const turno = await this.turnoService.crearTurnoUrgencia(dto);
    return {
      success: true,
      data: turno,
      mensaje: `Turno ${turno.numero_turno} creado exitosamente`,
    };
  }

  @Get(':id')
  async obtenerPorId(@Param('id') id: string) {
    const turno = await this.turnoService.obtenerPorId(id);
    return {
      success: true,
      data: turno,
    };
  }

  @Get('hospital/:hospital_id')
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

    return {
      success: true,
      data: turnos,
      total: turnos.length,
    };
  }

  @Put(':id/estado')
  @Roles('ENFERMERO', 'MEDICO', 'ADMIN')
  async actualizarEstado(
    @Param('id') id: string,
    @Body() dto: ActualizarEstadoTurnoDto,
  ) {
    const turno = await this.turnoService.actualizarEstado(id, dto);
    return {
      success: true,
      data: turno,
      mensaje: 'Estado actualizado exitosamente',
    };
  }

  @Put(':id/llamar')
  @Roles('MEDICO')
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
  async finalizarTurno(@Param('id') id: string, @Body() dto: FinalizarTurnoDto) {
    const turno = await this.turnoService.finalizarTurno(id, dto);
    return {
      success: true,
      data: turno,
      mensaje: 'Turno finalizado exitosamente',
    };
  }

  @Delete(':id')
  @Roles('ADMIN', 'RECEPCIONISTA')
  async cancelarTurno(@Param('id') id: string) {
    const turno = await this.turnoService.cancelarTurno(id);
    return {
      success: true,
      data: turno,
      mensaje: 'Turno cancelado',
    };
  }
}