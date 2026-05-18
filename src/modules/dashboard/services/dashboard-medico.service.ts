// src/modules/dashboard/services/dashboard-medico.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { DashboardMedico } from '../dto/dashboard-medico.dto';
import { EstadoTurno } from 'src/modules/turnos/entities/turno.entity';

@Injectable()
export class DashboardMedicoService {
  private readonly logger = new Logger(DashboardMedicoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async obtenerDashboard(
    hospitalId: number,
    medicoId?: string,
  ): Promise<DashboardMedico> {
    this.logger.debug(`Dashboard médico - Hospital: ${hospitalId}`);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const turnosPorNivel = await this.obtenerTurnosPorNivel(hospitalId, hoy);

    const alertasPendientes = await this.prisma.alertas_criticas.findMany({
      where: {
        hospital_id: hospitalId,
        activa: true,
        confirmada: false,
      },
      include: {
        turno: {
          include: {
            pacientes: true,
            nivel_triage: true,
          },
        },
      },
      orderBy: {
        creado_en: 'asc',
      },
    });

    const alertasConUsuarios = await Promise.all(
      alertasPendientes.map(async (alerta) => {
        if (alerta.turno?.pacientes) {
          const usuario = await this.prisma.usuarios.findUnique({
            where: { id: alerta.turno.pacientes.usuario_id },
          });
          return {
            ...alerta,
            turno: {
              ...alerta.turno,
              pacientes: {
                ...alerta.turno.pacientes,
                usuarios: usuario,
              },
            },
          };
        }
        return alerta;
      }),
    );

    let metricasPersonales = {
      atendidos_hoy: 0,
      tiempo_promedio_atencion: 0,
      en_consulta_ahora: 0,
    };

    if (medicoId) {
      metricasPersonales = await this.calcularMetricasPersonales(medicoId, hoy);
    }

    return {
      por_niveles: turnosPorNivel,
      alertas_pendientes: alertasConUsuarios as any,
      metricas_personales: metricasPersonales,
    };
  }

  private async obtenerTurnosPorNivel(hospitalId: number, fecha: Date) {
    const turnosActivos = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        estado: { in: [EstadoTurno.EN_ESPERA, EstadoTurno.EN_CONSULTA] },
        fecha: { gte: fecha },
      },
      include: {
        pacientes: true,
        nivel_triage: true,
        registro_triage: {
          include: {
            confirmaciones: {
              orderBy: { creado_en: 'desc' as const },
              take: 1,
              select: {
                acepto_sugerencia: true,
                nivel_final_enfermero: true,
                razon_modificacion: true,
              },
            },
          },
        },
      },
      orderBy: {
        creado_en: 'asc',
      },
    });

    const turnosConUsuarios = await Promise.all(
      turnosActivos.map(async (turno) => {
        if (turno.pacientes) {
          const usuario = await this.prisma.usuarios.findUnique({
            where: { id: turno.pacientes.usuario_id },
          });
          return {
            ...turno,
            pacientes: {
              ...turno.pacientes,
              usuarios: usuario,
            },
          };
        }
        return turno;
      }),
    );

    return {
      nivel_1: turnosConUsuarios.filter((t) => t.nivel_triage_id === 1) as any,
      nivel_2: turnosConUsuarios.filter((t) => t.nivel_triage_id === 2) as any,
      nivel_3: turnosConUsuarios.filter((t) => t.nivel_triage_id === 3) as any,
      nivel_4: turnosConUsuarios.filter((t) => t.nivel_triage_id === 4) as any,
      nivel_5: turnosConUsuarios.filter((t) => t.nivel_triage_id === 5) as any,
    };
  }

  private async calcularMetricasPersonales(medicoId: string, fecha: Date) {
    const atendidosHoy = await this.prisma.turnos.count({
      where: {
        medico_id: medicoId,
        estado: EstadoTurno.ATENDIDO,
        fecha: { gte: fecha },
      },
    });

    const enConsultaAhora = await this.prisma.turnos.count({
      where: {
        medico_id: medicoId,
        estado: EstadoTurno.EN_CONSULTA,
      },
    });

    const turnosFinalizados = await this.prisma.turnos.findMany({
      where: {
        medico_id: medicoId,
        estado: EstadoTurno.ATENDIDO,
        fecha: { gte: fecha },
        llamado_en: { not: null },
        finalizado_en: { not: null },
      },
    });

    let tiempoPromedioAtencion = 0;
    if (turnosFinalizados.length > 0) {
      const sumaTiempos = turnosFinalizados.reduce((sum, turno) => {
        const tiempo = turno.finalizado_en.getTime() - turno.llamado_en.getTime();
        return sum + tiempo;
      }, 0);
      tiempoPromedioAtencion = Math.floor(sumaTiempos / turnosFinalizados.length / 60000);
    }

    return {
      atendidos_hoy: atendidosHoy,
      tiempo_promedio_atencion: tiempoPromedioAtencion,
      en_consulta_ahora: enConsultaAhora,
    };
  }
}