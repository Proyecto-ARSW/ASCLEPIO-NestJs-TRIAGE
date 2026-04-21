// src/modules/alertas/controllers/alerta.controller.ts

import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AlertaCriticaService } from '../services/alerta-critica.service';
import { AlertaTriageService } from '../services/alerta-triage.service';
import { EscalamientoService } from '../services/escalamiento.service';
import { CrearAlertaCriticaDto } from '../dto/crear-alerta-critica.dto';
import { ConfirmarAlertaDto } from '../dto/confirmar-alerta.dto';
import { EscalarAlertaDto } from '../dto/escalar-alerta.dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('alertas')
@UseGuards(AuthGuard, RolesGuard)
export class AlertaController {
  private readonly logger = new Logger(AlertaController.name);

  constructor(
    private readonly alertaCriticaService: AlertaCriticaService,
    private readonly alertaTriageService: AlertaTriageService,
    private readonly escalamientoService: EscalamientoService,
  ) {}

  /**
   * POST /api/triage/alertas/critica
   * Crea una alerta crítica
   */
  @Post('critica')
  @Roles('ENFERMERO', 'ADMIN')
  async crearAlertaCritica(@Body() dto: CrearAlertaCriticaDto) {
    this.logger.log(
      `Crear alerta crítica - Turno: ${dto.turno_id} - Nivel: ${dto.nivel_triage}`,
    );

    const resultado = await this.alertaCriticaService.crearAlerta(dto);

    return {
      success: true,
      data: resultado,
    };
  }

  /**
   * PUT /api/triage/alertas/:id/confirmar
   * Confirma una alerta (médico acepta atender)
   */
  @Put(':id/confirmar')
  @Roles('MEDICO', 'JEFE_GUARDIA')
  async confirmarAlerta(
    @Param('id') alertaId: string,
    @Body() dto: Omit<ConfirmarAlertaDto, 'alerta_id'>,
  ) {
    this.logger.log(`Confirmar alerta ${alertaId} - Médico: ${dto.medico_id}`);

    const alerta = await this.alertaCriticaService.confirmarAlerta({
      alerta_id: alertaId,
      medico_id: dto.medico_id,
    });

    return {
      success: true,
      data: alerta,
      mensaje: 'Alerta confirmada exitosamente',
    };
  }

  /**
   * PUT /api/triage/alertas/:id/escalar
   * Escala una alerta al jefe de guardia
   */
  @Put(':id/escalar')
  @Roles('ADMIN', 'JEFE_GUARDIA')
  async escalarAlerta(
    @Param('id') alertaId: string,
    @Body() dto: Omit<EscalarAlertaDto, 'alerta_id'>,
  ) {
    this.logger.log(
      `Escalar alerta ${alertaId} - Jefe: ${dto.jefe_guardia_id}`,
    );

    const alerta = await this.escalamientoService.escalarAlerta({
      alerta_id: alertaId,
      jefe_guardia_id: dto.jefe_guardia_id,
      razon_escalamiento: dto.razon_escalamiento,
    });

    return {
      success: true,
      data: alerta,
      mensaje: 'Alerta escalada exitosamente',
    };
  }

  /**
   * GET /api/triage/alertas/hospital/:hospital_id
   * Obtiene todas las alertas activas de un hospital
   */
  @Get('hospital/:hospital_id')
  @Roles('MEDICO', 'JEFE_GUARDIA', 'ADMIN')
  async obtenerAlertasHospital(@Param('hospital_id') hospitalId: string) {
    const alertasCriticas =
      await this.alertaCriticaService.obtenerAlertasActivas(parseInt(hospitalId));

    const alertasTiempoEspera =
      await this.alertaTriageService.obtenerAlertasActivas(parseInt(hospitalId));

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

  /**
   * GET /api/triage/alertas/:id
   * Obtiene una alerta específica
   */
  @Get(':id')
  @Roles('MEDICO', 'JEFE_GUARDIA', 'ADMIN')
  async obtenerAlerta(@Param('id') alertaId: string) {
    const alerta = await this.alertaCriticaService.obtenerPorId(alertaId);

    return {
      success: true,
      data: alerta,
    };
  }

  /**
   * POST /api/triage/alertas/escalamiento/procesar
   * Procesa escalamiento automático (llamado por cron)
   */
  @Post('escalamiento/procesar')
  @Roles('ADMIN')
  async procesarEscalamientoAutomatico() {
    this.logger.log('Procesando escalamiento automático...');

    const cantidad = await this.escalamientoService.procesarEscalamientoAutomatico();

    return {
      success: true,
      data: {
        alertas_escaladas: cantidad,
      },
      mensaje: `${cantidad} alerta(s) escalada(s) automáticamente`,
    };
  }
}