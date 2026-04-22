// src/modules/dashboard/services/dashboard-recepcionista.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { DashboardRecepcionista } from '../dto/dashboard-recepcionista.dto';
import { EstadoTurno } from 'src/modules/turnos/entities/turno.entity';

@Injectable()
export class DashboardRecepcionistaService {
  private readonly logger = new Logger(DashboardRecepcionistaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el dashboard de la recepcionista
   */
  async obtenerDashboard(hospitalId: number): Promise<DashboardRecepcionista> {
    this.logger.debug(`Dashboard recepcionista - Hospital: ${hospitalId}`);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const resumen = await this.obtenerResumenDia(hospitalId, hoy);

    const alertas = await this.obtenerAlertasActivas(hospitalId);

    const turnosActivos = await this.obtenerTurnosActivos(hospitalId);

    return {
      resumen,
      alertas_activas: alertas,
      turnos_activos: turnosActivos,
      total_turnos_activos: turnosActivos.length,
    };
  }

  /**
   * Obtiene turnos activos
   */
  async obtenerTurnosActivos(hospitalId: number) {
    const turnos = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        estado: {
          notIn: [EstadoTurno.ATENDIDO, EstadoTurno.CANCELADO],
        },
        fecha: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      include: {
        pacientes: true,
        nivel_triage: true,
      },
      orderBy: [{ nivel_triage_id: 'asc' }, { creado_en: 'asc' }],
    });

    const turnosConDatos = await Promise.all(
      turnos.map(async (turno) => {
        const tiempoEsperaMs = new Date().getTime() - turno.creado_en.getTime();
        const tiempoEsperaMin = Math.floor(tiempoEsperaMs / 60000);

        let pacienteNombre = 'Desconocido';
        if (turno.pacientes) {
          const usuario = await this.prisma.usuarios.findUnique({
            where: { id: turno.pacientes.usuario_id },
          });
          if (usuario) {
            pacienteNombre = `${usuario.nombre} ${usuario.apellido}`;
          }
        }

        let consultorio = undefined;
        if (turno.medico_id) {
          const medico = await this.prisma.medicos.findUnique({
            where: { id: turno.medico_id },
          });
          consultorio = medico?.consultorio;
        }

        return {
          numero_turno: turno.numero_turno,
          paciente_nombre: pacienteNombre,
          estado: turno.estado,
          nivel_triage: turno.nivel_triage_id || 0,
          tiempo_espera_minutos: tiempoEsperaMin,
          consultorio,
        };
      }),
    );

    return turnosConDatos;
  }

  /**
   * Buscar paciente por criterios
   */
  async buscarPaciente(criterio: string) {
    this.logger.debug(`Buscando paciente: ${criterio}`);

    const pacientesPorDocumento = await this.prisma.pacientes.findMany({
      where: {
        numero_documento: { contains: criterio, mode: 'insensitive' },
      },
      take: 10,
    });

    const usuarios = await this.prisma.usuarios.findMany({
      where: {
        OR: [
          { nombre: { contains: criterio, mode: 'insensitive' } },
          { apellido: { contains: criterio, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });

    const usuariosIds = usuarios.map((u) => u.id);
    const pacientesPorNombre = await this.prisma.pacientes.findMany({
      where: {
        usuario_id: { in: usuariosIds },
      },
      take: 10,
    });

    const pacientesUnicos = new Map();
    [...pacientesPorDocumento, ...pacientesPorNombre].forEach((p) => {
      pacientesUnicos.set(p.id, p);
    });

    const resultado = await Promise.all(
      Array.from(pacientesUnicos.values()).map(async (p) => {
        const usuario = await this.prisma.usuarios.findUnique({
          where: { id: p.usuario_id },
        });

        return {
          paciente_id: p.id,
          nombre: usuario?.nombre || 'Desconocido',
          apellido: usuario?.apellido || '',
          documento: p.numero_documento,
          tipo_documento: p.tipo_documento,
          eps: p.eps,
        };
      }),
    );

    return resultado.slice(0, 10); 
  }

  /**
   * Obtiene resumen del día
   */
  private async obtenerResumenDia(hospitalId: number, fecha: Date) {
    const turnosHoy = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        fecha: {
          gte: fecha,
        },
      },
    });

    const turnosCreados = turnosHoy.length;
    const enEspera = turnosHoy.filter(
      (t) =>
        t.estado === EstadoTurno.EN_ESPERA ||
        t.estado === EstadoTurno.CLASIFICACION_PENDIENTE ||
        t.estado === EstadoTurno.ESPERANDO_CONFIRMACION,
    ).length;
    const atendidos = turnosHoy.filter((t) => t.estado === EstadoTurno.ATENDIDO).length;
    const cancelados = turnosHoy.filter((t) => t.estado === EstadoTurno.CANCELADO).length;
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
      turnos_creados: turnosCreados,
      en_espera: enEspera,
      atendidos,
      cancelados,
      tiempo_promedio_espera: tiempoPromedioEspera,
    };
  }

  /**
   * Obtiene alertas activas
   */
  private async obtenerAlertasActivas(hospitalId: number) {
    const alertas: Array<{
      turno_id: string;  
      numero_turno: number;
      tipo: string;
      mensaje: string;
      timestamp: Date;
    }> = [];

    // Alertas críticas
    const alertasCriticas = await this.prisma.alertas_criticas.findMany({
      where: {
        hospital_id: hospitalId,
        activa: true,
      },
      include: {
        turno: true,  
      },
    });

    for (const alerta of alertasCriticas) {
      if (alerta.turno) {
        alertas.push({
          turno_id: alerta.turno_id,
          numero_turno: alerta.turno.numero_turno,
          tipo: alerta.tipo_alerta,
          mensaje: `Nivel ${alerta.nivel_triage} - ${alerta.tipo_alerta}`,
          timestamp: alerta.creado_en,
        });
      }
    }

    const alertasTiempo = await this.prisma.alertas_triage.findMany({
      where: {
        hospital_id: hospitalId,
        resuelta: false,
      },
      include: {
        turno: true, 
      },
    });

    for (const alerta of alertasTiempo) {
      if (alerta.turno) {
        alertas.push({
          turno_id: alerta.turno_id,
          numero_turno: alerta.turno.numero_turno,
          tipo: 'TIEMPO_EXCEDIDO',
          mensaje: alerta.mensaje || `Tiempo excedido: ${alerta.tiempo_excedido_minutos} min`,
          timestamp: alerta.creado_en,
        });
      }
    }

    return alertas;
  }
}