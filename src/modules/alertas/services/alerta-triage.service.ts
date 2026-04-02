// src/modules/alertas/services/alerta-triage.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertaTriage } from '../entities/alerta-triage.entity';

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
    nivelTriage: number,
    tiempoEspera: number,
    tiempoMax: number,
  ): Promise<AlertaTriage> {
    this.logger.warn(
      `Creando alerta tiempo espera - Turno: ${turnoId} - Espera: ${tiempoEspera}min (Max: ${tiempoMax}min)`,
    );

    const alerta = await this.prisma.alertas_triage.create({
      data: {
        turno_id: turnoId,
        hospital_id: hospitalId,
        nivel_triage: nivelTriage,
        tiempo_espera_minutos: tiempoEspera,
        tiempo_max_espera_minutos: tiempoMax,
        mensaje: `Paciente lleva ${tiempoEspera} minutos en espera (Máximo: ${tiempoMax} min)`,
        resuelta: false,
      },
      include: {
        turnos: {
          include: {
            pacientes: {
              include: {
                usuarios: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Alerta tiempo espera creada: ${alerta.id}`);

    return alerta as AlertaTriage;
  }

  /**
   * Marca una alerta como resuelta
   */
  async resolverAlerta(alertaId: string): Promise<AlertaTriage> {
    const alerta = await this.prisma.alertas_triage.update({
      where: { id: alertaId },
      data: {
        resuelta: true,
        resuelta_en: new Date(),
      },
    });

    return alerta as AlertaTriage;
  }

  /**
   * Obtiene alertas activas de tiempo de espera
   */
  async obtenerAlertasActivas(hospitalId: number): Promise<AlertaTriage[]> {
    const alertas = await this.prisma.alertas_triage.findMany({
      where: {
        hospital_id: hospitalId,
        resuelta: false,
      },
      include: {
        turnos: {
          include: {
            pacientes: {
              include: {
                usuarios: true,
              },
            },
          },
        },
      },
      orderBy: {
        tiempo_espera_minutos: 'desc',
      },
    });

    return alertas as AlertaTriage[];
  }
}