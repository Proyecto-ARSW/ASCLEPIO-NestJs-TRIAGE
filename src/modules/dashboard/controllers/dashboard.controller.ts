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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
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

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
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

  @Get('paciente/:turno_id')
  @ApiOperation({ summary: 'Dashboard del paciente', description: 'Retorna información del turno: posición en cola, nivel de triage, tiempo estimado de espera.' })
  @ApiParam({ name: 'turno_id', description: 'ID UUID del turno del paciente', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Dashboard del paciente.' })
  @ApiResponse({ status: 404, description: 'Turno no encontrado.' })
  async getDashboardPaciente(@Param('turno_id') turnoId: string) {
    const dashboard = await this.dashboardPacienteService.obtenerDashboard(turnoId);
    return { success: true, data: dashboard };
  }

  @Get('paciente/:turno_id/posicion')
  @ApiOperation({ summary: 'Posición del paciente en cola' })
  @ApiParam({ name: 'turno_id', description: 'ID UUID del turno', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Posición actual en la cola de espera.' })
  async getPosicionPaciente(@Param('turno_id') turnoId: string) {
    const posicion = await this.dashboardPacienteService.obtenerPosicion(turnoId);
    return { success: true, data: posicion };
  }

  @Get('recepcionista/:hospital_id')
  @Roles('RECEPCIONISTA', 'ADMIN')
  @ApiOperation({ summary: 'Dashboard del recepcionista', description: 'Vista general del estado del hospital: turnos activos, estadísticas del día. Roles: RECEPCIONISTA, ADMIN.' })
  @ApiParam({ name: 'hospital_id', description: 'ID del hospital', example: '1' })
  @ApiResponse({ status: 200, description: 'Dashboard del recepcionista.' })
  async getDashboardRecepcionista(@Param('hospital_id') hospitalId: string) {
    const dashboard = await this.dashboardRecepcionistaService.obtenerDashboard(parseInt(hospitalId));
    return { success: true, data: dashboard };
  }

  @Get('recepcionista/:hospital_id/turnos-activos')
  @Roles('RECEPCIONISTA', 'ADMIN')
  @ApiOperation({ summary: 'Turnos activos del hospital', description: 'Lista de todos los turnos activos del hospital en este momento. Roles: RECEPCIONISTA, ADMIN.' })
  @ApiParam({ name: 'hospital_id', description: 'ID del hospital', example: '1' })
  @ApiResponse({ status: 200, description: 'Lista de turnos activos.' })
  async getTurnosActivos(@Param('hospital_id') hospitalId: string) {
    const turnos = await this.dashboardRecepcionistaService.obtenerTurnosActivos(parseInt(hospitalId));
    return { success: true, data: turnos, total: turnos.length };
  }

  @Post('recepcionista/buscar-paciente')
  @Roles('RECEPCIONISTA', 'ADMIN')
  @ApiOperation({ summary: 'Buscar paciente', description: 'Búsqueda de pacientes por nombre, cédula u otro criterio. Roles: RECEPCIONISTA, ADMIN.' })
  @ApiBody({ schema: { type: 'object', properties: { criterio: { type: 'string', example: 'Juan García' } }, required: ['criterio'] } })
  @ApiResponse({ status: 201, description: 'Resultados de búsqueda.' })
  async buscarPaciente(@Body() body: { criterio: string }) {
    const pacientes = await this.dashboardRecepcionistaService.buscarPaciente(body.criterio);
    return { success: true, data: pacientes };
  }

  @Get('enfermero/:hospital_id')
  @Roles('ENFERMERO', 'ADMIN')
  @ApiOperation({ summary: 'Dashboard del enfermero', description: 'Cola de pacientes esperando triage, próximos en atender. Roles: ENFERMERO, ADMIN.' })
  @ApiParam({ name: 'hospital_id', description: 'ID del hospital', example: '1' })
  @ApiResponse({ status: 200, description: 'Dashboard del enfermero.' })
  async getDashboardEnfermero(@Param('hospital_id') hospitalId: string) {
    const dashboard = await this.dashboardEnfermeroService.obtenerDashboard(parseInt(hospitalId));
    return { success: true, data: dashboard };
  }

  @Get('medico/:hospital_id')
  @Roles('MEDICO', 'JEFE_GUARDIA', 'ADMIN')
  @ApiOperation({ summary: 'Dashboard del médico', description: 'Pacientes asignados al médico autenticado, alertas activas. Roles: MEDICO, JEFE_GUARDIA, ADMIN.' })
  @ApiParam({ name: 'hospital_id', description: 'ID del hospital', example: '1' })
  @ApiResponse({ status: 200, description: 'Dashboard del médico.' })
  async getDashboardMedico(
    @Param('hospital_id') hospitalId: string,
    @CurrentUser('id') medicoId?: string,
  ) {
    const dashboard = await this.dashboardMedicoService.obtenerDashboard(parseInt(hospitalId), medicoId);
    return { success: true, data: dashboard };
  }

  @Get('jefe-guardia/:hospital_id')
  @Roles('JEFE_GUARDIA', 'ADMIN')
  @ApiOperation({ summary: 'Dashboard del jefe de guardia', description: 'Vista de alertas escaladas, médicos activos y estado general del hospital. Roles: JEFE_GUARDIA, ADMIN.' })
  @ApiParam({ name: 'hospital_id', description: 'ID del hospital', example: '1' })
  @ApiResponse({ status: 200, description: 'Dashboard del jefe de guardia.' })
  async getDashboardJefeGuardia(@Param('hospital_id') hospitalId: string) {
    const dashboard = await this.dashboardJefeGuardiaService.obtenerDashboard(parseInt(hospitalId));
    return { success: true, data: dashboard };
  }

  @Get('admin/:hospital_id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Dashboard administrativo', description: 'Métricas completas del hospital: estadísticas de triage, tiempos de espera, uso de recursos. Rol: ADMIN.' })
  @ApiParam({ name: 'hospital_id', description: 'ID del hospital', example: '1' })
  @ApiResponse({ status: 200, description: 'Dashboard administrativo.' })
  async getDashboardAdmin(@Param('hospital_id') hospitalId: string) {
    this.logger.log(`Dashboard admin solicitado - Hospital: ${hospitalId}`);
    const dashboard = await this.dashboardAdminService.obtenerDashboard(parseInt(hospitalId));
    return { success: true, data: dashboard };
  }
}
