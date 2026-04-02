// src/modules/dashboard/controllers/dashboard.controller.ts

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { DashboardPacienteService } from '../services/dashboard-paciente.service';
import { DashboardRecepcionistaService } from '../services/dashboard-recepcionista.service';
import { DashboardEnfermeroService } from '../services/dashboard-enfermero.service';
import { DashboardMedicoService } from '../services/dashboard-medico.service';
import { DashboardJefeGuardiaService } from '../services/dashboard-jefe-guardia.service';
import { DashboardAdminService } from '../services/dashboard-admin.service';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(AuthGuard, RolesGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(
    private readonly dashboardPacienteService: DashboardPacienteService,
    private readonly dashboardRecepcionistaService: DashboardRecepcionistaService,
    private readonly dashboardEnfermeroService: DashboardEnfermeroService,
    private readonly dashboardMedicoService: DashboardMedicoService,
    private readonly dashboardJefeGuardiaService: DashboardJefeGuardiaService,
    private readonly dashboardAdminService: DashboardAdminService,
  ) {}

  // DASHBOARD PACIENTE

  @Get('paciente/:turno_id')
  async getDashboardPaciente(@Param('turno_id') turnoId: string) {
    const dashboard = await this.dashboardPacienteService.obtenerDashboard(turnoId);

    return {
      success: true,
      data: dashboard,
    };
  }

  @Get('paciente/:turno_id/posicion')
  async getPosicionPaciente(@Param('turno_id') turnoId: string) {
    const posicion = await this.dashboardPacienteService.obtenerPosicion(turnoId);

    return {
      success: true,
      data: posicion,
    };
  }

  // DASHBOARD RECEPCIONISTA

  @Get('recepcionista/:hospital_id')
  @Roles('RECEPCIONISTA', 'ADMIN')
  async getDashboardRecepcionista(@Param('hospital_id') hospitalId: string) {
    const dashboard = await this.dashboardRecepcionistaService.obtenerDashboard(
      parseInt(hospitalId),
    );

    return {
      success: true,
      data: dashboard,
    };
  }

  @Get('recepcionista/:hospital_id/turnos-activos')
  @Roles('RECEPCIONISTA', 'ADMIN')
  async getTurnosActivos(@Param('hospital_id') hospitalId: string) {
    const turnos = await this.dashboardRecepcionistaService.obtenerTurnosActivos(
      parseInt(hospitalId),
    );

    return {
      success: true,
      data: turnos,
      total: turnos.length,
    };
  }

  @Post('recepcionista/buscar-paciente')
  @Roles('RECEPCIONISTA', 'ADMIN')
  async buscarPaciente(@Body() body: { criterio: string }) {
    const pacientes = await this.dashboardRecepcionistaService.buscarPaciente(
      body.criterio,
    );

    return {
      success: true,
      data: pacientes,
    };
  }

  // DASHBOARD ENFERMERO

  @Get('enfermero/:hospital_id')
  @Roles('ENFERMERO', 'ADMIN')
  async getDashboardEnfermero(@Param('hospital_id') hospitalId: string) {
    const dashboard = await this.dashboardEnfermeroService.obtenerDashboard(
      parseInt(hospitalId),
    );

    return {
      success: true,
      data: dashboard,
    };
  }

  // DASHBOARD MÉDICO

  @Get('medico/:hospital_id')
  @Roles('MEDICO', 'JEFE_GUARDIA', 'ADMIN')
  async getDashboardMedico(
    @Param('hospital_id') hospitalId: string,
    @CurrentUser('id') medicoId?: string,
  ) {
    const dashboard = await this.dashboardMedicoService.obtenerDashboard(
      parseInt(hospitalId),
      medicoId,
    );

    return {
      success: true,
      data: dashboard,
    };
  }

  // DASHBOARD JEFE DE GUARDIA

  @Get('jefe-guardia/:hospital_id')
  @Roles('JEFE_GUARDIA', 'ADMIN')
  async getDashboardJefeGuardia(@Param('hospital_id') hospitalId: string) {
    const dashboard = await this.dashboardJefeGuardiaService.obtenerDashboard(
      parseInt(hospitalId),
    );

    return {
      success: true,
      data: dashboard,
    };
  }

  // DASHBOARD ADMINISTRATIVO


  @Get('admin/:hospital_id')
  @Roles('ADMIN')
  async getDashboardAdmin(@Param('hospital_id') hospitalId: string) {
    this.logger.log(`Dashboard admin solicitado - Hospital: ${hospitalId}`);

    const dashboard = await this.dashboardAdminService.obtenerDashboard(
      parseInt(hospitalId),
    );

    return {
      success: true,
      data: dashboard,
    };
  }
}