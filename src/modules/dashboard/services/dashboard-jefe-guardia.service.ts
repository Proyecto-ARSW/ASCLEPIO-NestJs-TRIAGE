// src/modules/dashboard/services/dashboard-jefe-guardia.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MetricasIAService } from '@/modules/confirmacion/services/metricas-ia.service';
import { DashboardJefeGuardia } from '../dto/dashboard-jefe-guardia.dto';
import { EstadoTurno } from '@/modules/turnos/entities/turno.entity';

@Injectable()
export class DashboardJefeGuardiaService {
  private readonly logger = new Logger(DashboardJefeGuardiaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricasIAService: MetricasIAService,
  ) {}

  /**
   * Obtiene el dashboard del jefe de guardia
   */
  async obtenerDashboard(hospitalId: number): Promise<DashboardJefeGuardia> {
    this.logger.debug(`Dashboard jefe guardia - Hospital: ${hospitalId}`);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const alertasEscaladas = await this.prisma.alertas_criticas.findMany({
      where: {
        hospital_id: hospitalId,
        escalada: true,
        activa: true,
      },
      include: {
        turnos: {
          include: {
            pacientes: {
              include: { usuarios: true },
            },
          },
        },
      },
      orderBy: {
        escalada_en: 'asc',
      },
    });

    const metricasTiempoReal = await this.calcularMetricasTiempoReal(hospitalId, hoy);

    const distribucionNiveles = await this.calcularDistribucionNiveles(hospitalId, hoy);

    const tiemposPromedio = await this.calcularTiemposPromedio(hospitalId, hoy);

    const enfermeros = await this.obtenerEstadoEnfermeros(hospitalId);
    const medicos = await this.obtenerEstadoMedicos(hospitalId);

    const metricasIA = await this.metricasIAService.calcularMetricasIA(hospitalId, hoy);

    return {
      alertas_escaladas: alertasEscaladas as any,
      metricas_tiempo_real: metricasTiempoReal,
      distribucion_niveles: distribucionNiveles,
      tiempos_promedio: tiemposPromedio,
      enfermeros,
      medicos,
      metricas_ia: {
        precision_global: metricasIA.precision_general,
        precision_nivel_1: metricasIA.precision_nivel_1,
        precision_nivel_2: metricasIA.precision_nivel_2,
        precision_nivel_3: metricasIA.precision_nivel_3,
        precision_nivel_4: metricasIA.precision_nivel_4,
        precision_nivel_5: metricasIA.precision_nivel_5,
        escalamientos: metricasIA.escalamientos,
        degradaciones: metricasIA.degradaciones,
      },
    };
  }

  /**
   * Calcula métricas en tiempo real
   */
  private async calcularMetricasTiempoReal(hospitalId: number, fecha: Date) {
    const turnos = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        fecha: { gte: fecha },
      },
    });

    return {
      en_espera: turnos.filter(t => t.estado === EstadoTurno.EN_ESPERA).length,
      atendiendo: turnos.filter(t => t.estado === EstadoTurno.EN_CONSULTA).length,
      atendidos: turnos.filter(t => t.estado === EstadoTurno.ATENDIDO).length,
      cancelados: turnos.filter(t => t.estado === EstadoTurno.CANCELADO).length,
    };
  }

  /**
   * Calcula distribución por niveles
   */
  private async calcularDistribucionNiveles(hospitalId: number, fecha: Date) {
    const turnos = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        fecha: { gte: fecha },
        nivel_triage_id: { not: null },
      },
    });

    const total = turnos.length || 1;

    const counts = {
      nivel_1: turnos.filter(t => t.nivel_triage_id === 1).length,
      nivel_2: turnos.filter(t => t.nivel_triage_id === 2).length,
      nivel_3: turnos.filter(t => t.nivel_triage_id === 3).length,
      nivel_4: turnos.filter(t => t.nivel_triage_id === 4).length,
      nivel_5: turnos.filter(t => t.nivel_triage_id === 5).length,
    };

    return {
      nivel_1: counts.nivel_1,
      nivel_1_porcentaje: (counts.nivel_1 / total) * 100,
      nivel_2: counts.nivel_2,
      nivel_2_porcentaje: (counts.nivel_2 / total) * 100,
      nivel_3: counts.nivel_3,
      nivel_3_porcentaje: (counts.nivel_3 / total) * 100,
      nivel_4: counts.nivel_4,
      nivel_4_porcentaje: (counts.nivel_4 / total) * 100,
      nivel_5: counts.nivel_5,
      nivel_5_porcentaje: (counts.nivel_5 / total) * 100,
    };
  }

  /**
   * Calcula tiempos promedio
   */
  private async calcularTiemposPromedio(hospitalId: number, fecha: Date) {
    const turnos = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        fecha: { gte: fecha },
        estado: EstadoTurno.ATENDIDO,
      },
      include: {
        cuestionario: true,
        registro_triage: true,
        confirmaciones_enfermero: true,
      },
    });

    if (turnos.length === 0) {
      return {
        cuestionario_a_vitales: 0,
        vitales_a_confirmacion: 0,
        confirmacion_a_llamado: 0,
        total_espera: 0,
        tiempo_atencion: 0,
      };
    }

    let sumaCuestionarioVitales = 0;
    let sumaVitalesConfirmacion = 0;
    let sumaConfirmacionLlamado = 0;
    let sumaTotalEspera = 0;
    let sumaTiempoAtencion = 0;

    let countCuestionarioVitales = 0;
    let countVitalesConfirmacion = 0;
    let countConfirmacionLlamado = 0;
    let countTotalEspera = 0;
    let countTiempoAtencion = 0;

    for (const turno of turnos) {

      if (turno.cuestionario?.creado_en && turno.registro_triage?.creado_en) {
        const diff =
          turno.registro_triage.creado_en.getTime() -
          turno.cuestionario.creado_en.getTime();
        sumaCuestionarioVitales += diff;
        countCuestionarioVitales++;
      }

      if (
        turno.registro_triage?.creado_en &&
        turno.confirmaciones_enfermero?.[0]?.creado_en
      ) {
        const diff =
          turno.confirmaciones_enfermero[0].creado_en.getTime() -
          turno.registro_triage.creado_en.getTime();
        sumaVitalesConfirmacion += diff;
        countVitalesConfirmacion++;
      }

      if (turno.confirmaciones_enfermero?.[0]?.creado_en && turno.llamado_en) {
        const diff =
          turno.llamado_en.getTime() -
          turno.confirmaciones_enfermero[0].creado_en.getTime();
        sumaConfirmacionLlamado += diff;
        countConfirmacionLlamado++;
      }

      if (turno.llamado_en) {
        const diff = turno.llamado_en.getTime() - turno.creado_en.getTime();
        sumaTotalEspera += diff;
        countTotalEspera++;
      }

      if (turno.llamado_en && turno.finalizado_en) {
        const diff = turno.finalizado_en.getTime() - turno.llamado_en.getTime();
        sumaTiempoAtencion += diff;
        countTiempoAtencion++;
      }
    }

    return {
      cuestionario_a_vitales: countCuestionarioVitales
        ? Math.floor(sumaCuestionarioVitales / countCuestionarioVitales / 60000)
        : 0,
      vitales_a_confirmacion: countVitalesConfirmacion
        ? Math.floor(sumaVitalesConfirmacion / countVitalesConfirmacion / 60000)
        : 0,
      confirmacion_a_llamado: countConfirmacionLlamado
        ? Math.floor(sumaConfirmacionLlamado / countConfirmacionLlamado / 60000)
        : 0,
      total_espera: countTotalEspera
        ? Math.floor(sumaTotalEspera / countTotalEspera / 60000)
        : 0,
      tiempo_atencion: countTiempoAtencion
        ? Math.floor(sumaTiempoAtencion / countTiempoAtencion / 60000)
        : 0,
    };
  }

  /**
   * Obtiene estado de enfermeros
   */
  private async obtenerEstadoEnfermeros(hospitalId: number) {
    const enfermeros = await this.prisma.enfermeros.findMany({
      where: {
        activo: true,
        usuarios: {
          hospital_usuario: {
            some: { hospital_id: hospitalId },
          },
        },
      },
      include: {
        usuarios: true,
      },
    });

    // Verificar si están atendiendo un turno actualmente
    const enfermeroEstados = await Promise.all(
      enfermeros.map(async enfermero => {
        const ultimoTurno = await this.prisma.turnos.findFirst({
          where: {
            enfermero_triage_id: enfermero.id,
            estado: {
              in: [
                EstadoTurno.ESPERANDO_VITALES,
                EstadoTurno.TRIAGE_COMPLETO,
              ],
            },
          },
          orderBy: { actualizado_en: 'desc' },
        });

        return {
          id: enfermero.id,
          nombre: `${enfermero.usuarios.nombre} ${enfermero.usuarios.apellido}`,
          rol: 'ENFERMERO',
          estado: ultimoTurno ? 'OCUPADO' : 'DISPONIBLE',
          turno_actual: ultimoTurno
            ? `Turno #${ultimoTurno.numero_turno}`
            : undefined,
        };
      }),
    );

    return enfermeroEstados;
  }

  /**
   * Obtiene estado de médicos
   */
  private async obtenerEstadoMedicos(hospitalId: number) {
    const medicos = await this.prisma.medicos.findMany({
      where: {
        activo: true,
        usuarios: {
          hospital_usuario: {
            some: { hospital_id: hospitalId },
          },
        },
      },
      include: {
        usuarios: true,
      },
    });

    const medicoEstados = await Promise.all(
      medicos.map(async medico => {
        const turnoActual = await this.prisma.turnos.findFirst({
          where: {
            medico_id: medico.id,
            estado: EstadoTurno.EN_CONSULTA,
          },
        });

        return {
          id: medico.id,
          nombre: `${medico.usuarios.nombre} ${medico.usuarios.apellido}`,
          rol: 'MEDICO',
          estado: turnoActual ? 'OCUPADO' : 'DISPONIBLE',
          turno_actual: turnoActual
            ? `Turno #${turnoActual.numero_turno}`
            : undefined,
          consultorio: medico.consultorio,
        };
      }),
    );

    return medicoEstados;
  }
}