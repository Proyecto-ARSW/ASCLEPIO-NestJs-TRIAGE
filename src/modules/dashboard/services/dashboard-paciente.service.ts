// src/modules/dashboard/services/dashboard-paciente.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ColaService } from '@/modules/cola/services/cola.service';
import { DashboardPaciente } from '../dto/dashboard-paciente.dto';
import { EstadoTurno } from '@/modules/turnos/entities/turno.entity';

@Injectable()
export class DashboardPacienteService {
  private readonly logger = new Logger(DashboardPacienteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly colaService: ColaService,
  ) {}

  /**
   * Obtiene el dashboard del paciente
   */
  async obtenerDashboard(turnoId: string): Promise<DashboardPaciente> {
    this.logger.debug(`Dashboard paciente - Turno: ${turnoId}`);

    const turno = await this.prisma.turnos.findUnique({
      where: { id: turnoId },
      include: {
        pacientes: {
          include: {
            usuarios: true,
          },
        },
        nivel_triage: true,
        medicos: {
          include: {
            usuarios: true,
          },
        },
      },
    });

    if (!turno) {
      throw new NotFoundException('Turno no encontrado');
    }
    const tiempoEsperaMs = new Date().getTime() - turno.creado_en.getTime();
    const tiempoEsperaMin = Math.floor(tiempoEsperaMs / 60000);

    let posicionCola = 0;
    let totalCola = 0;

    if (turno.estado === EstadoTurno.EN_ESPERA && turno.nivel_triage_id) {
      const posicion = await this.colaService.obtenerPosicionEnCola(
        turnoId,
        turno.hospital_id,
        turno.nivel_triage_id,
      );

      posicionCola = posicion !== null ? posicion + 1 : 0;

      const colaCompleta = await this.colaService.obtenerColaPorNivel(
        turno.hospital_id,
        turno.nivel_triage_id,
      );

      totalCola = colaCompleta.total;
    }
    const pacientesDelante = await this.contarPacientesDelantePorNivel(
      turno.hospital_id,
      turno.nivel_triage_id || 5,
      turnoId,
    );
    const tiempoEstimado = this.calcularTiempoEstimado(
      turno.nivel_triage_id || 5,
      posicionCola,
    );
    const historial = await this.construirHistorial(turno);

    return {
      turno: {
        numero_turno: turno.numero_turno,
        estado: turno.estado,
        nivel_triage: turno.nivel_triage_id || 0,
        nivel_nombre: turno.nivel_triage?.nombre || 'Pendiente',
        nivel_color: turno.nivel_triage?.color_codigo || '#999999',
        tiempo_espera_minutos: tiempoEsperaMin,
        posicion_en_cola: posicionCola,
        total_en_cola: totalCola,
        consultorio_asignado: turno.medicos?.consultorio,
        medico_asignado: turno.medicos
          ? `${turno.medicos.usuarios.nombre} ${turno.medicos.usuarios.apellido}`
          : undefined,
      },
      pacientes_delante: pacientesDelante,
      tiempo_estimado_espera: tiempoEstimado,
      historial,
    };
  }

  /**
   * Obtiene posición actual en cola
   */
  async obtenerPosicion(turnoId: string): Promise<{ posicion: number; total: number }> {
    const turno = await this.prisma.turnos.findUnique({
      where: { id: turnoId },
    });

    if (!turno || !turno.nivel_triage_id) {
      return { posicion: 0, total: 0 };
    }

    const posicion = await this.colaService.obtenerPosicionEnCola(
      turnoId,
      turno.hospital_id,
      turno.nivel_triage_id,
    );

    const colaCompleta = await this.colaService.obtenerColaPorNivel(
      turno.hospital_id,
      turno.nivel_triage_id,
    );

    return {
      posicion: posicion !== null ? posicion + 1 : 0,
      total: colaCompleta.total,
    };
  }

  /**
   * Cuenta pacientes delante por nivel
   */
  private async contarPacientesDelantePorNivel(
    hospitalId: number,
    nivelActual: number,
    turnoId: string,
  ) {
    const counts = { nivel_1: 0, nivel_2: 0, nivel_3: 0 };
    for (let nivel = 1; nivel < nivelActual; nivel++) {
      const cola = await this.colaService.obtenerColaPorNivel(hospitalId, nivel);
      
      if (nivel === 1) counts.nivel_1 = cola.total;
      if (nivel === 2) counts.nivel_2 = cola.total;
      if (nivel === 3) counts.nivel_3 = cola.total;
    }

    return counts;
  }

  /**
   * Calcula tiempo estimado de espera
   */
  private calcularTiempoEstimado(nivel: number, posicion: number): number {
    const tiemposAtencion = {
      1: 25,
      2: 22,
      3: 18,
      4: 15,
      5: 12,
    };

    const tiempoPorPaciente = tiemposAtencion[nivel] || 15;
    return posicion * tiempoPorPaciente;
  }

  /**
   * Construye historial de pasos del turno
   */
  private async construirHistorial(turno: any) {
    const historial: Array<{ paso: string; timestamp: Date; completado: boolean }> = [];

    historial.push({
      paso: 'Turno creado',
      timestamp: turno.creado_en,
      completado: true,
    });

    const cuestionario = await this.prisma.cuestionario_triage.findFirst({
      where: { turno_id: turno.id },
    });

    if (cuestionario) {
      historial.push({
        paso: 'Cuestionario completado',
        timestamp: cuestionario.creado_en,
        completado: true,
      });
    } else if (turno.estado === EstadoTurno.CUESTIONARIO_PENDIENTE) {
      historial.push({
        paso: 'Cuestionario pendiente',
        timestamp: new Date(),
        completado: false,
      });
    }
    const registroTriage = await this.prisma.registros_triage.findFirst({
      where: { paciente_id: turno.paciente_id },
      orderBy: { creado_en: 'desc' },
    });

    if (registroTriage) {
      historial.push({
        paso: 'Vitales registrados',
        timestamp: registroTriage.creado_en,
        completado: true,
      });
    } else if (turno.estado === EstadoTurno.ESPERANDO_VITALES) {
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
        paso: `Llamado a consultorio ${turno.medicos?.consultorio || ''}`,
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