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

  /**
   * Cron job: Ejecuta cada minuto
   * Escala alertas críticas no confirmadas después de 3 minutos
   */
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
   * Cron job: Ejecuta cada 5 minutos
   * Verifica si algún paciente EN_ESPERA excedió el tiempo máximo de su nivel de triage
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async verificarTiemposEspera() {
    this.logger.debug('Cron: Verificando tiempos de espera...');

    try {
      // Obtener todos los hospitales activos
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
   * Verifica tiempos de espera excedidos para un hospital específico
   */
  private async verificarTiemposHospital(hospitalId: number): Promise<number> {
    // Obtener turnos EN_ESPERA con nivel de triage asignado
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

      // Si el tiempo de espera excede el máximo para su nivel
      if (tiempoEsperaMin > tiempoMaximo) {
        const tiempoExcedido = tiempoEsperaMin - tiempoMaximo;

        // Verificar si ya existe alerta activa para este turno
        const alertaExistente = await this.prisma.alertas_triage.findFirst({
          where: {
            turno_id: turno.id,
            tipo_alerta: 'TIEMPO_ESPERA_EXCEDIDO',
            resuelta: false,
          },
        });

        if (alertaExistente) continue;

        // Crear alerta de tiempo excedido
        await this.alertaTriageService.crearAlertaTiempoEspera(
          turno.id,
          hospitalId,
          tiempoExcedido,
        );

        // Obtener nombre del paciente para notificación
        let pacienteNombre = 'Desconocido';
        if (turno.pacientes) {
          const usuario = await this.prisma.usuarios.findUnique({
            where: { id: turno.pacientes.usuario_id },
          });
          if (usuario) {
            pacienteNombre = `${usuario.nombre} ${usuario.apellido}`;
          }
        }

        // WebSocket: notificar a dashboards
        this.triageGateway.emitToDashboardMedicos(
          hospitalId,
          'alerta:tiempo-excedido',
          {
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
          },
        );

        this.triageGateway.emitToDashboardEnfermeros(
          hospitalId,
          'alerta:tiempo-excedido',
          {
            turno_id: turno.id,
            numero_turno: turno.numero_turno,
            paciente_nombre: pacienteNombre,
            nivel_triage: turno.nivel_triage_id,
            nombre_nivel: turno.nivel_triage.nombre,
            tiempo_espera_min: tiempoEsperaMin,
            tiempo_excedido_min: tiempoExcedido,
            timestamp: new Date().toISOString(),
          },
        );

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
