// src/modules/alertas/services/alerta-triage.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class AlertaTriageService {
  private readonly logger = new Logger(AlertaTriageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una alerta de tiempo de espera excedido
   */
  async crearAlertaTiempoEspera(
    turnoId: string,
    hospitalId: number,
    tiempoExcedido: number,
  ): Promise<any> {
    this.logger.warn(
      `Creando alerta tiempo espera - Turno: ${turnoId} - Tiempo excedido: ${tiempoExcedido}min`,
    );

    const alerta = await this.prisma.alertas_triage.create({
      data: {
        turno_id: turnoId,
        hospital_id: hospitalId,
        tipo_alerta: 'TIEMPO_ESPERA_EXCEDIDO',
        nivel_severidad: 'ALTA',
        mensaje: `Paciente lleva ${tiempoExcedido} minutos en espera excedida`,
        tiempo_excedido_minutos: tiempoExcedido,
        resuelta: false,
      },
      include: {
        turno: {  // ← CAMBIADO de "turnos" a "turno"
          include: {
            pacientes: true,
          },
        },
      },
    });

    this.logger.log(`Alerta tiempo espera creada: ${alerta.id}`);

    return alerta;
  }

  /**
   * Marca una alerta como resuelta
   */
  async resolverAlerta(alertaId: string, resueltoBy?: string): Promise<any> {
    const alerta = await this.prisma.alertas_triage.update({
      where: { id: alertaId },
      data: {
        resuelta: true,
        resuelta_en: new Date(),
        resuelta_por: resueltoBy || null,
      },
    });

    return alerta;
  }

  /**
   * Obtiene alertas activas de tiempo de espera
   */
  async obtenerAlertasActivas(hospitalId: number): Promise<any[]> {
    const alertas = await this.prisma.alertas_triage.findMany({
      where: {
        hospital_id: hospitalId,
        resuelta: false,
      },
      include: {
        turno: {  // ← CAMBIADO de "turnos" a "turno"
          include: {
            pacientes: true,
          },
        },
      },
      orderBy: {
        tiempo_excedido_minutos: 'desc',  // ← CAMBIADO de "tiempo_espera_minutos"
      },
    });

    return alertas;
  }

  /**
   * Resuelve todas las alertas de un turno
   */
  async resolverAlertasPorTurno(turnoId: string): Promise<void> {
    await this.prisma.alertas_triage.updateMany({
      where: {
        turno_id: turnoId,
        resuelta: false,
      },
      data: {
        resuelta: true,
        resuelta_en: new Date(),
      },
    });

    this.logger.log(`Alertas resueltas para turno ${turnoId}`);
  }
}