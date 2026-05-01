// src/modules/tasks/tasks.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { EscalamientoService } from '../alertas/services/escalamiento.service';
import { AlertaTriageService } from '../alertas/services/alerta-triage.service';
import { TriageGateway } from '../websockets/gateways/triage.gateway';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escalamientoService: EscalamientoService,
    private readonly alertaTriageService: AlertaTriageService,
    private readonly triageGateway: TriageGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async procesarEscalamientoAutomatico() {
    this.logger.debug('Cron: Verificando alertas para escalamiento...');
    try {
      const escaladas = await this.escalamientoService.procesarEscalamientoAutomatico();
      if (escaladas > 0) {
        this.logger.warn(`Cron: ${escaladas} alerta(s) escalada(s) automáticamente`);
      }
    } catch (error: any) {
      this.logger.error(`Cron: Error en escalamiento automático: ${error?.message || error}`);
    }
  }

  /**
   * Cron job: Ejecuta cada minuto
   * Expira alertas con más de 5 minutos de vida (TTL)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expirarAlertasAntiguas() {
    this.logger.debug('Cron: Expirando alertas con TTL de 5 minutos...');
    const ttl = new Date(Date.now() - 5 * 60 * 1000);
    try {
      const [criticas, espera] = await Promise.all([
        this.prisma.alertas_criticas.updateMany({
          where: { activa: true, creado_en: { lte: ttl } },
          data: { activa: false },
        }),
        this.prisma.alertas_triage.updateMany({
          where: { resuelta: false, creado_en: { lte: ttl } },
          data: { resuelta: true, resuelta_en: new Date() },
        }),
      ]);
      if (criticas.count > 0 || espera.count > 0) {
        this.logger.log(
          `TTL expiradas: ${criticas.count} alerta(s) crítica(s), ${espera.count} alerta(s) de espera`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Cron: Error expirando alertas: ${error?.message || error}`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async verificarTiemposEspera() {
    this.logger.debug('Cron: Verificando tiempos de espera...');
    try {
      const hospitales = await this.prisma.hospitales.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
      });
      let totalAlertas = 0;
      for (const hospital of hospitales) {
        const alertasCreadas = await this.verificarTiemposHospital(hospital.id);
        totalAlertas += alertasCreadas;
      }
      if (totalAlertas > 0) {
        this.logger.warn(`Cron: ${totalAlertas} alerta(s) de tiempo excedido creadas`);
      }
    } catch (error: any) {
      this.logger.error(`Cron: Error verificando tiempos de espera: ${error?.message || error}`);
    }
  }

  private async verificarTiemposHospital(hospitalId: number): Promise<number> {
    const turnosEnEspera = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        estado: 'EN_ESPERA',
        nivel_triage_id: { not: null },
      },
      include: {
        nivel_triage: true,
        pacientes: true,
      },
    });

    let alertasCreadas = 0;

    for (const turno of turnosEnEspera) {
      if (!turno.nivel_triage || !turno.actualizado_en) continue;

      const tiempoEsperaMin = Math.floor(
        (Date.now() - turno.actualizado_en.getTime()) / 60000,
      );
      const tiempoMaximo = turno.nivel_triage.tiempo_max_espera_min;
      if (tiempoEsperaMin > tiempoMaximo) {
        const tiempoExcedido = tiempoEsperaMin - tiempoMaximo;
        const alertaExistente = await this.prisma.alertas_triage.findFirst({
          where: {
            turno_id: turno.id,
            tipo_alerta: 'TIEMPO_ESPERA_EXCEDIDO',
            resuelta: false,
          },
        });

        if (alertaExistente) continue;
        await this.alertaTriageService.crearAlertaTiempoEspera(
          turno.id,
          hospitalId,
          tiempoExcedido,
        );
        let pacienteNombre = 'Desconocido';
        if (turno.pacientes) {
          const usuario = await this.prisma.usuarios.findUnique({
            where: { id: turno.pacientes.usuario_id },
          });
          if (usuario) {
            pacienteNombre = `${usuario.nombre} ${usuario.apellido}`;
          }
        }
        this.triageGateway.emitToDashboardMedicos(hospitalId, 'alerta:tiempo-excedido', {
          turno_id: turno.id,
          numero_turno: turno.numero_turno,
          paciente_nombre: pacienteNombre,
          nivel_triage: turno.nivel_triage_id,
          nombre_nivel: turno.nivel_triage.nombre,
          color: turno.nivel_triage.color_codigo,
          tiempo_espera_min: tiempoEsperaMin,
          tiempo_max_min: tiempoMaximo,
          tiempo_excedido_min: tiempoExcedido,
          timestamp: new Date().toISOString(),
        });
        this.triageGateway.emitToDashboardEnfermeros(hospitalId, 'alerta:tiempo-excedido', {
          turno_id: turno.id,
          numero_turno: turno.numero_turno,
          paciente_nombre: pacienteNombre,
          nivel_triage: turno.nivel_triage_id,
          nombre_nivel: turno.nivel_triage.nombre,
          tiempo_espera_min: tiempoEsperaMin,
          tiempo_excedido_min: tiempoExcedido,
          timestamp: new Date().toISOString(),
        });
        this.logger.warn(
          `Tiempo excedido - Turno: ${turno.numero_turno}, Nivel: ${turno.nivel_triage.nombre}, ` +
          `Espera: ${tiempoEsperaMin}min (máx: ${tiempoMaximo}min, excedido: ${tiempoExcedido}min)`,
        );
        alertasCreadas++;
      }
    }
    return alertasCreadas;
  }
}