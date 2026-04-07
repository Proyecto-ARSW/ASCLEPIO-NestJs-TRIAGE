// src/modules/dashboard/services/dashboard-enfermero.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { DashboardEnfermero } from '../dto/dashboard-enfermero.dto';
import { EstadoTurno } from 'src/modules/turnos/entities/turno.entity';

@Injectable()
export class DashboardEnfermeroService {
  private readonly logger = new Logger(DashboardEnfermeroService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el dashboard del enfermero
   */
  async obtenerDashboard(hospitalId: number): Promise<DashboardEnfermero> {
    this.logger.debug(`🩺 Dashboard enfermero - Hospital: ${hospitalId}`);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // 1. Turnos críticos (niveles 1 y 2 en espera)
    const criticos = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        nivel_triage_id: {
          in: [1, 2],
        },
        estado: EstadoTurno.EN_ESPERA,
        fecha: { gte: hoy },
      },
      include: {
        pacientes: true, 
        nivel_triage: true,
      },
      orderBy: {
        nivel_triage_id: 'asc',
      },
    });

    // 2. Turnos esperando vitales
    const esperandoVitales = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        estado: EstadoTurno.ESPERANDO_VITALES,
        fecha: { gte: hoy },
      },
      include: {
        pacientes: true,
      },
      orderBy: {
        creado_en: 'asc',
      },
    });

    const esperandoConfirmacion = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        estado: EstadoTurno.TRIAGE_COMPLETO,
        fecha: { gte: hoy },
      },
      include: {
        pacientes: true, 
        registro_triage: true,
      },
      orderBy: {
        actualizado_en: 'asc',
      },
    });

    const criticosConUsuarios = await this.agregarUsuariosATurnos(criticos);
    const esperandoVitalesConUsuarios = await this.agregarUsuariosATurnos(esperandoVitales);
    const esperandoConfirmacionConUsuarios = await this.agregarUsuariosATurnos(esperandoConfirmacion);

    const metricas = await this.calcularMetricasDia(hospitalId, hoy);

    return {
      criticos: criticosConUsuarios as any,
      esperando_vitales: esperandoVitalesConUsuarios as any,
      esperando_confirmacion: esperandoConfirmacionConUsuarios as any,
      metricas_dia: metricas,
    };
  }

  /**
   * Agrega información de usuarios a los turnos
   */
  private async agregarUsuariosATurnos(turnos: any[]) {
    const turnosConUsuarios = [];

    for (const turno of turnos) {
      if (turno.pacientes) {
        const usuario = await this.prisma.usuarios.findUnique({
          where: { id: turno.pacientes.usuario_id },
        });

        turnosConUsuarios.push({
          ...turno,
          pacientes: {
            ...turno.pacientes,
            usuarios: usuario,
          },
        });
      } else {
        turnosConUsuarios.push(turno);
      }
    }

    return turnosConUsuarios;
  }

  /**
   * Calcula métricas del día
   */
  private async calcularMetricasDia(hospitalId: number, fecha: Date) {
    const turnosHoy = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        fecha: { gte: fecha },
        estado: EstadoTurno.ATENDIDO,
      },
    });

    const totalAtendidos = turnosHoy.length;

    const porNivel = {
      nivel_1: turnosHoy.filter((t) => t.nivel_triage_id === 1).length,
      nivel_2: turnosHoy.filter((t) => t.nivel_triage_id === 2).length,
      nivel_3: turnosHoy.filter((t) => t.nivel_triage_id === 3).length,
      nivel_4: turnosHoy.filter((t) => t.nivel_triage_id === 4).length,
      nivel_5: turnosHoy.filter((t) => t.nivel_triage_id === 5).length,
    };

    const turnosConTiempos = turnosHoy.filter((t) => t.llamado_en);
    let tiempoPromedioEspera = 0;

    if (turnosConTiempos.length > 0) {
      const sumaEsperas = turnosConTiempos.reduce((sum, turno) => {
        const espera = turno.llamado_en.getTime() - turno.creado_en.getTime();
        return sum + espera;
      }, 0);

      tiempoPromedioEspera = Math.floor(sumaEsperas / turnosConTiempos.length / 60000);
    }

    return {
      total_atendidos: totalAtendidos,
      por_nivel_1: porNivel.nivel_1,
      por_nivel_2: porNivel.nivel_2,
      por_nivel_3: porNivel.nivel_3,
      por_nivel_4: porNivel.nivel_4,
      por_nivel_5: porNivel.nivel_5,
      tiempo_promedio_espera: tiempoPromedioEspera,
    };
  }
}