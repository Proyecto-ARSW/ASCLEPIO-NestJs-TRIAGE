// src/modules/tasks/tasks.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { EscalamientoService } from '../alertas/services/escalamiento.service';
import { AlertaTriageService } from '../alertas/services/alerta-triage.service';
import { TriageGateway } from '../websockets/gateways/triage.gateway';
import { ColaService } from '../cola/services/cola.service';

const MINUTOS_GRACIA_AUTOCANCELACION = 20;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escalamientoService: EscalamientoService,
    private readonly alertaTriageService: AlertaTriageService,
    private readonly triageGateway: TriageGateway,
    private readonly colaService: ColaService,
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

  /**
   * Cancela automáticamente los turnos EN_ESPERA que superaron
   * el tiempo máximo del nivel + 20 minutos de gracia.
   * Nivel 1 (tiempo_max = 0) queda excluido — requiere atención inmediata
   * y debe manejarse por el personal, no por cancelación automática.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cancelarTurnosVencidos() {
    this.logger.debug('Cron: Verificando turnos con tiempo vencido para auto-cancelar...');
    try {
      const turnosEnEspera = await this.prisma.turnos.findMany({
        where: {
          estado: 'EN_ESPERA',
          nivel_triage_id: { not: null },
        },
        include: { nivel_triage: true, pacientes: true },
      });

      let cancelados = 0;

      for (const turno of turnosEnEspera) {
        if (!turno.nivel_triage || !turno.actualizado_en) continue;

        // Nivel 1 no se auto-cancela — requiere intervención inmediata del personal
        if (turno.nivel_triage.tiempo_max_espera_min === 0) continue;

        const tiempoLimiteMin =
          turno.nivel_triage.tiempo_max_espera_min + MINUTOS_GRACIA_AUTOCANCELACION;

        const minutosEsperando = Math.floor(
          (Date.now() - turno.actualizado_en.getTime()) / 60000,
        );

        if (minutosEsperando < tiempoLimiteMin) continue;

        // Cancelar el turno en BD
        await this.prisma.turnos.update({
          where: { id: turno.id },
          data: { estado: 'CANCELADO', finalizado_en: new Date() },
        });

        // Limpiar de la cola Redis
        if (turno.nivel_triage_id) {
          try {
            await this.colaService.removerDeCola(
              turno.id,
              turno.hospital_id,
              turno.nivel_triage_id,
            );
          } catch (e) {
            this.logger.warn(`No se pudo limpiar Redis para turno ${turno.id}: ${e}`);
          }
        }

        // Notificar a todos los dashboards vía WebSocket
        const payload = {
          turno_id: turno.id,
          numero_turno: turno.numero_turno,
          nivel_triage: turno.nivel_triage_id,
          nombre_nivel: turno.nivel_triage.nombre,
          minutos_esperados: minutosEsperando,
          tiempo_max_min: turno.nivel_triage.tiempo_max_espera_min,
          razon: `Tiempo máximo de espera superado (${minutosEsperando} min, límite: ${tiempoLimiteMin} min)`,
          timestamp: new Date().toISOString(),
        };

        this.triageGateway.emitToDashboardMedicos(
          turno.hospital_id,
          'turno:cancelado-automatico',
          payload,
        );
        this.triageGateway.emitToDashboardEnfermeros(
          turno.hospital_id,
          'turno:cancelado-automatico',
          payload,
        );

        this.logger.warn(
          `Auto-cancelado turno #${turno.numero_turno} ` +
            `(N${turno.nivel_triage_id} — ${minutosEsperando}min esperando, ` +
            `límite: ${tiempoLimiteMin}min)`,
        );

        cancelados++;
      }

      if (cancelados > 0) {
        this.logger.warn(
          `Cron: ${cancelados} turno(s) cancelado(s) automáticamente por tiempo vencido`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Cron: Error en cancelación automática de turnos: ${error?.message || error}`,
      );
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