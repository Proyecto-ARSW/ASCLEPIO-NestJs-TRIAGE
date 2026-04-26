// src/modules/alertas/controllers/alerta.controller.ts

import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AlertaCriticaService } from '../services/alerta-critica.service';
import { AlertaTriageService } from '../services/alerta-triage.service';
import { EscalamientoService } from '../services/escalamiento.service';
import { CrearAlertaCriticaDto } from '../dto/crear-alerta-critica.dto';
import { ConfirmarAlertaDto } from '../dto/confirmar-alerta.dto';
import { EscalarAlertaDto } from '../dto/escalar-alerta.dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@ApiTags('Alertas')
@ApiBearerAuth('JWT-auth')
@Controller('alertas')
@UseGuards(AuthGuard, RolesGuard)
export class AlertaController {
  private readonly logger = new Logger(AlertaController.name);

  constructor(
    private readonly alertaCriticaService: AlertaCriticaService,
    private readonly alertaTriageService: AlertaTriageService,
    private readonly escalamientoService: EscalamientoService,
  ) {}

  @Post('critica')
  @Roles('ENFERMERO', 'ADMIN')
  @ApiOperation({ summary: 'Crear alerta crítica', description: 'Genera una alerta crítica para un turno con nivel de triage 1 o 2. Roles: ENFERMERO, ADMIN.' })
  @ApiResponse({ status: 201, description: 'Alerta crítica creada y notificaciones enviadas.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos.' })
  async crearAlertaCritica(@Body() dto: CrearAlertaCriticaDto) {
    this.logger.log(`Crear alerta crítica - Turno: ${dto.turno_id} - Nivel: ${dto.nivel_triage}`);
    const resultado = await this.alertaCriticaService.crearAlerta(dto);
    return { success: true, data: resultado };
  }

  @Put(':id/confirmar')
  @Roles('MEDICO', 'JEFE_GUARDIA')
  @ApiOperation({ summary: 'Confirmar alerta', description: 'El médico o jefe de guardia acepta atender la alerta crítica. Roles: MEDICO, JEFE_GUARDIA.' })
  @ApiParam({ name: 'id', description: 'ID UUID de la alerta', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Alerta confirmada.' })
  @ApiResponse({ status: 404, description: 'Alerta no encontrada.' })
  async confirmarAlerta(
    @Param('id') alertaId: string,
    @Body() dto: Omit<ConfirmarAlertaDto, 'alerta_id'>,
  ) {
    this.logger.log(`Confirmar alerta ${alertaId} - Médico: ${dto.medico_id}`);
    const alerta = await this.alertaCriticaService.confirmarAlerta({
      alerta_id: alertaId,
      medico_id: dto.medico_id,
    });
    return { success: true, data: alerta, mensaje: 'Alerta confirmada exitosamente' };
  }

  @Put(':id/escalar')
  @Roles('ADMIN', 'JEFE_GUARDIA')
  @ApiOperation({ summary: 'Escalar alerta al jefe de guardia', description: 'Escala manualmente una alerta crítica no atendida. Roles: ADMIN, JEFE_GUARDIA.' })
  @ApiParam({ name: 'id', description: 'ID UUID de la alerta', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Alerta escalada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Alerta no encontrada.' })
  async escalarAlerta(
    @Param('id') alertaId: string,
    @Body() dto: Omit<EscalarAlertaDto, 'alerta_id'>,
  ) {
    this.logger.log(`Escalar alerta ${alertaId} - Jefe: ${dto.jefe_guardia_id}`);
    const alerta = await this.escalamientoService.escalarAlerta({
      alerta_id: alertaId,
      jefe_guardia_id: dto.jefe_guardia_id,
      razon_escalamiento: dto.razon_escalamiento,
    });
    return { success: true, data: alerta, mensaje: 'Alerta escalada exitosamente' };
  }

  @Get('hospital/:hospital_id')
  @Roles('MEDICO', 'JEFE_GUARDIA', 'ADMIN')
  @ApiOperation({ summary: 'Obtener alertas activas del hospital', description: 'Retorna alertas críticas y de tiempo de espera activas. Roles: MEDICO, JEFE_GUARDIA, ADMIN.' })
  @ApiParam({ name: 'hospital_id', description: 'ID del hospital', example: '1' })
  @ApiResponse({ status: 200, description: 'Alertas activas del hospital.' })
  async obtenerAlertasHospital(@Param('hospital_id') hospitalId: string) {
    const alertasCriticas = await this.alertaCriticaService.obtenerAlertasActivas(parseInt(hospitalId));
    const alertasTiempoEspera = await this.alertaTriageService.obtenerAlertasActivas(parseInt(hospitalId));
    return {
      success: true,
      data: {
        alertas_criticas: alertasCriticas,
        alertas_tiempo_espera: alertasTiempoEspera,
        total_criticas: alertasCriticas.length,
        total_tiempo_espera: alertasTiempoEspera.length,
      },
    };
  }

  @Get(':id')
  @Roles('MEDICO', 'JEFE_GUARDIA', 'ADMIN')
  @ApiOperation({ summary: 'Obtener alerta por ID' })
  @ApiParam({ name: 'id', description: 'ID UUID de la alerta', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Alerta encontrada.' })
  @ApiResponse({ status: 404, description: 'Alerta no encontrada.' })
  async obtenerAlerta(@Param('id') alertaId: string) {
    const alerta = await this.alertaCriticaService.obtenerPorId(alertaId);
    return { success: true, data: alerta };
  }

  @Post('escalamiento/procesar')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Procesar escalamiento automático', description: 'Ejecuta el proceso de escalamiento automático de alertas no atendidas (invocado por cron). Rol: ADMIN.' })
  @ApiResponse({ status: 201, description: 'Escalamiento procesado.' })
  async procesarEscalamientoAutomatico() {
    this.logger.log('Procesando escalamiento automático...');
    const cantidad = await this.escalamientoService.procesarEscalamientoAutomatico();
    return {
      success: true,
      data: { alertas_escaladas: cantidad },
      mensaje: `${cantidad} alerta(s) escalada(s) automáticamente`,
    };
  }
}
