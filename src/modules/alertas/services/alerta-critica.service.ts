// src/modules/alertas/services/alerta-critica.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CrearAlertaCriticaDto } from '../dto/crear-alerta-critica.dto';
import { ConfirmarAlertaDto } from '../dto/confirmar-alerta.dto';
import { AlertaResponse } from '../dto/alerta-response.dto';
import { AlertaCritica } from '../entities/alerta-critica.entity';

@Injectable()
export class AlertaCriticaService {
  private readonly logger = new Logger(AlertaCriticaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una alerta crítica
   */
  async crearAlerta(dto: CrearAlertaCriticaDto): Promise<AlertaResponse> {
    this.logger.warn(
      `Creando alerta crítica - Turno: ${dto.turno_id} - Nivel: ${dto.nivel_triage} - Tipo: ${dto.tipo_alerta}`,
    );

    const alertaExistente = await this.prisma.alertas_criticas.findFirst({
      where: {
        turno_id: dto.turno_id,
        activa: true,
      },
    });

    if (alertaExistente) {
      this.logger.warn(`Ya existe alerta activa para turno ${dto.turno_id}`);
      return {
        alerta: alertaExistente as any,
        mensaje: 'Alerta ya existente',
        notificado_a: [],
      };
    }

    const alerta = await this.prisma.alertas_criticas.create({
      data: {
        turno_id: dto.turno_id,
        hospital_id: dto.hospital_id,
        nivel_triage: dto.nivel_triage,
        tipo_alerta: dto.tipo_alerta,
        // REMOVIDO: medico_asignado_id (no existe en schema)
        confirmada: false,
        escalada: false,
        activa: true,
      },
      include: {
        turno: {  // ← CAMBIADO de "turnos" a "turno"
          include: {
            pacientes: true,
            nivel_triage: true,
          },
        },
      },
    });

    this.logger.log(`Alerta creada: ${alerta.id}`);

    return {
      alerta: alerta as any,
      mensaje: `Alerta crítica creada - Nivel ${dto.nivel_triage}`,
      notificado_a: [],
    };
  }

  /**
   * Confirma una alerta (médico acepta atender)
   */
  async confirmarAlerta(dto: ConfirmarAlertaDto): Promise<any> {
    this.logger.log(
      `Confirmando alerta ${dto.alerta_id} - Médico: ${dto.medico_id}`,
    );

    const alerta = await this.obtenerPorId(dto.alerta_id);

    if (alerta.confirmada) {
      this.logger.warn(`Alerta ${dto.alerta_id} ya fue confirmada`);
      return alerta;
    }

    const alertaActualizada = await this.prisma.alertas_criticas.update({
      where: { id: dto.alerta_id },
      data: {
        confirmada: true,
        confirmada_en: new Date(),
        confirmada_por: dto.medico_id,
        activa: false,
      },
      include: {
        turno: {  // ← CAMBIADO de "turnos" a "turno"
          include: {
            pacientes: true,
          },
        },
      },
    });

    this.logger.log(`Alerta confirmada por médico ${dto.medico_id}`);

    return alertaActualizada;
  }

  /**
   * Obtiene una alerta por ID
   */
  async obtenerPorId(id: string): Promise<any> {
    const alerta = await this.prisma.alertas_criticas.findUnique({
      where: { id },
      include: {
        turno: {  // ← CAMBIADO de "turnos" a "turno"
          include: {
            pacientes: true,
            nivel_triage: true,
          },
        },
      },
    });

    if (!alerta) {
      throw new NotFoundException('Alerta no encontrada');
    }

    return alerta;
  }

  /**
   * Obtiene todas las alertas activas de un hospital
   */
  async obtenerAlertasActivas(hospitalId: number): Promise<any[]> {
    const alertas = await this.prisma.alertas_criticas.findMany({
      where: {
        hospital_id: hospitalId,
        activa: true,
      },
      include: {
        turno: {  // ← CAMBIADO de "turnos" a "turno"
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

    return alertas;
  }

  /**
   * Obtiene alertas pendientes de confirmación (para cron de escalamiento)
   */
  async obtenerAlertasPendientesEscalamiento(): Promise<any[]> {
    const tiempoLimite = new Date();
    tiempoLimite.setMinutes(tiempoLimite.getMinutes() - 3);

    const alertas = await this.prisma.alertas_criticas.findMany({
      where: {
        activa: true,
        confirmada: false,
        escalada: false,
        creado_en: {
          lte: tiempoLimite,
        },
      },
      include: {
        turno: {  // ← CAMBIADO de "turnos" a "turno"
          include: {
            pacientes: true,
          },
        },
      },
    });

    return alertas;
  }

  /**
   * Desactiva una alerta (cuando el turno es atendido)
   */
  async desactivarAlerta(turnoId: string): Promise<void> {
    await this.prisma.alertas_criticas.updateMany({
      where: {
        turno_id: turnoId,
        activa: true,
      },
      data: {
        activa: false,
      },
    });

    this.logger.log(`Alertas desactivadas para turno ${turnoId}`);
  }

  async buscarUsuarios(ids: string[]) {
    return this.prisma.usuarios.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, apellido: true },
    });
  }

  /**
   * Obtiene médicos disponibles en el hospital
   */
  private async obtenerMedicosDisponibles(
    hospitalId: number,
  ): Promise<string[]> {
    const medicos = await this.prisma.medicos.findMany({
      where: {
        activo: true,
        // REMOVIDO: hospital_usuario (relación que no existe)
      },
      select: {
        id: true,
      },
    });

    return medicos.map((m) => m.id);
  }
}