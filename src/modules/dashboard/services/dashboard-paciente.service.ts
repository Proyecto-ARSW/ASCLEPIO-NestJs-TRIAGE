// src/modules/dashboard/services/dashboard-paciente.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ColaService } from 'src/modules/cola/services/cola.service';
import { DashboardPaciente } from '../dto/dashboard-paciente.dto';
import { EstadoTurno } from 'src/modules/turnos/entities/turno.entity';

@Injectable()
export class DashboardPacienteService {
  private readonly logger = new Logger(DashboardPacienteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly colaService: ColaService,
  ) {}

  async obtenerDashboard(turnoId: string): Promise<DashboardPaciente> {
    this.logger.debug(`Dashboard paciente - Turno: ${turnoId}`);

    const turno = await this.prisma.turnos.findUnique({
      where: { id: turnoId },
      include: {
        pacientes: true,
        nivel_triage: true,
      },
    });

    if (!turno) {
      throw new NotFoundException('Turno no encontrado');
    }

    let pacienteUsuario = null;
    if (turno.pacientes) {
      pacienteUsuario = await this.prisma.usuarios.findUnique({
        where: { id: turno.pacientes.usuario_id },
      });
    }

    let medicoData = null;
    let medicoUsuario = null;
    if (turno.medico_id) {
      medicoData = await this.prisma.medicos.findUnique({
        where: { id: turno.medico_id },
      });
      if (medicoData) {
        medicoUsuario = await this.prisma.usuarios.findUnique({
          where: { id: medicoData.usuario_id },
        });
      }
    }

    let nivelTriageData = null;
    if (turno.nivel_triage_id) {
      nivelTriageData = await this.prisma.niveles_triage.findUnique({
        where: { id: turno.nivel_triage_id },
      });
    }

    const tiempoEsperaMs = new Date().getTime() - turno.creado_en.getTime();
    const tiempoEsperaMin = Math.floor(tiempoEsperaMs / 60000);

    // Solo se consideran turnos del día actual en estado EN_ESPERA
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let posicionCola = 0;
    let totalCola = 0;

    if (turno.estado === EstadoTurno.EN_ESPERA && turno.nivel_triage_id) {
      // Pacientes del mismo nivel que llegaron antes (hoy, EN_ESPERA)
      const turnosDelante = await this.prisma.turnos.count({
        where: {
          hospital_id: turno.hospital_id,
          nivel_triage_id: turno.nivel_triage_id,
          estado: EstadoTurno.EN_ESPERA,
          creado_en: { gte: startOfDay, lt: turno.creado_en },
          id: { not: turnoId },
        },
      });

      // Total en cola del mismo nivel hoy
      totalCola = await this.prisma.turnos.count({
        where: {
          hospital_id: turno.hospital_id,
          nivel_triage_id: turno.nivel_triage_id,
          estado: EstadoTurno.EN_ESPERA,
          creado_en: { gte: startOfDay },
        },
      });

      posicionCola = turnosDelante + 1;
    }

    const pacientesDelante = await this.contarPacientesDelantePorNivel(
      turno.hospital_id,
      turno.nivel_triage_id || 5,
      turnoId,
      startOfDay,
    );

    const tiempoEstimado = this.calcularTiempoEstimado(
      turno.nivel_triage_id || 5,
      posicionCola,
      nivelTriageData?.tiempo_max_espera_min,
    );

    const historial = await this.construirHistorial(turno, medicoData);

    return {
      turno: {
        numero_turno: turno.numero_turno,
        estado: turno.estado,
        nivel_triage: turno.nivel_triage_id || 0,
        nivel_nombre: nivelTriageData?.nombre || 'Pendiente',
        nivel_color: nivelTriageData?.color_codigo || '#999999',
        tiempo_espera_minutos: tiempoEsperaMin,
        posicion_en_cola: posicionCola,
        total_en_cola: totalCola,
        consultorio_asignado: medicoData?.consultorio,
        medico_asignado: medicoUsuario
          ? `${medicoUsuario.nombre} ${medicoUsuario.apellido}`
          : undefined,
      },
      pacientes_delante: pacientesDelante,
      tiempo_estimado_espera: tiempoEstimado,
      historial,
    };
  }

  async obtenerPosicion(turnoId: string): Promise<{ posicion: number; total: number }> {
    const turno = await this.prisma.turnos.findUnique({
      where: { id: turnoId },
    });

    if (!turno || !turno.nivel_triage_id) {
      return { posicion: 0, total: 0 };
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const turnosDelante = await this.prisma.turnos.count({
      where: {
        hospital_id: turno.hospital_id,
        nivel_triage_id: turno.nivel_triage_id,
        estado: EstadoTurno.EN_ESPERA,
        creado_en: { gte: startOfDay, lt: turno.creado_en },
        id: { not: turnoId },
      },
    });

    const total = await this.prisma.turnos.count({
      where: {
        hospital_id: turno.hospital_id,
        nivel_triage_id: turno.nivel_triage_id,
        estado: EstadoTurno.EN_ESPERA,
        creado_en: { gte: startOfDay },
      },
    });

    return {
      posicion: turnosDelante + 1,
      total,
    };
  }

  /**
   * Cuenta pacientes en niveles de mayor prioridad que aún están
   * EN_ESPERA hoy. Solo se muestran N1, N2 y N3 en el UI.
   */
  private async contarPacientesDelantePorNivel(
    hospitalId: number,
    nivelActual: number,
    turnoId: string,
    startOfDay: Date,
  ) {
    const counts = { nivel_1: 0, nivel_2: 0, nivel_3: 0 };

    for (let nivel = 1; nivel < nivelActual && nivel <= 3; nivel++) {
      const count = await this.prisma.turnos.count({
        where: {
          hospital_id: hospitalId,
          nivel_triage_id: nivel,
          estado: EstadoTurno.EN_ESPERA,
          creado_en: { gte: startOfDay },
        },
      });

      if (nivel === 1) counts.nivel_1 = count;
      if (nivel === 2) counts.nivel_2 = count;
      if (nivel === 3) counts.nivel_3 = count;
    }

    return counts;
  }

  /**
   * Calcula el tiempo estimado de espera.
   *
   * Tiempo base = SLA del nivel (tiempo_max_espera_min de BD):
   *   N1=0min, N2=15min, N3=60min, N4=120min, N5=240min
   *
   * Por cada paciente del mismo nivel adelante en cola, se suma
   * el tiempo promedio de atención de ese nivel.
   */
  private calcularTiempoEstimado(
    nivel: number,
    posicion: number,
    tiempoMaxEsperaDB?: number,
  ): number {
    const slaDefecto: Record<number, number> = {
      1: 0,
      2: 15,
      3: 60,
      4: 120,
      5: 240,
    };

    const tiempoConsulta: Record<number, number> = {
      1: 10,
      2: 12,
      3: 15,
      4: 20,
      5: 25,
    };

    const tiempoBase = tiempoMaxEsperaDB ?? slaDefecto[nivel] ?? 60;
    const tiempoPorPaciente = tiempoConsulta[nivel] ?? 15;
    const pacientesDelante = Math.max(0, posicion - 1);

    return tiempoBase + pacientesDelante * tiempoPorPaciente;
  }

  private async construirHistorial(turno: any, medicoData: any) {
    const historial: Array<{ paso: string; timestamp: Date; completado: boolean }> = [];

    historial.push({
      paso: 'Turno creado',
      timestamp: turno.creado_en,
      completado: true,
    });

    const registroTriage = await this.prisma.registros_triage.findFirst({
      where: { paciente_id: turno.paciente_id },
      orderBy: { creado_en: 'desc' },
    });

    if (registroTriage) {
      historial.push({
        paso: 'Datos recibidos y clasificados',
        timestamp: registroTriage.creado_en,
        completado: true,
      });
    } else if (turno.estado === EstadoTurno.CLASIFICACION_PENDIENTE) {
      historial.push({
        paso: 'Esperando registro de vitales',
        timestamp: new Date(),
        completado: false,
      });
    }

    if (turno.nivel_triage_id) {
      const confirmacion = await this.prisma.confirmaciones_enfermero.findFirst({
        where: { registro_triage_id: turno.registro_triage_id },
      });
      if (confirmacion) {
        historial.push({
          paso: `Triage confirmado - Nivel ${turno.nivel_triage_id}`,
          timestamp: confirmacion.creado_en,
          completado: true,
        });
      }
    }

    if (turno.estado === EstadoTurno.EN_ESPERA) {
      historial.push({
        paso: 'En espera de ser llamado',
        timestamp: new Date(),
        completado: false,
      });
    }

    if (turno.llamado_en) {
      historial.push({
        paso: `Llamado a consultorio ${medicoData?.consultorio || ''}`,
        timestamp: turno.llamado_en,
        completado: true,
      });
    }

    if (turno.finalizado_en) {
      historial.push({
        paso: 'Consulta finalizada',
        timestamp: turno.finalizado_en,
        completado: true,
      });
    }

    return historial;
  }
}