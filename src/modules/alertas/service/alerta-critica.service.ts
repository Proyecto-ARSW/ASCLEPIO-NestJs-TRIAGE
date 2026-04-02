// src/modules/alertas/services/alerta-critica.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CrearAlertaCriticaDto } from '../dto/crear-alerta-critica.dto';
import { ConfirmarAlertaDto } from '../dto/confirmar-alerta.dto';
import { AlertaResponse } from '../dto/alerta-response.dto';
import { AlertaCritica, TipoAlerta } from '../entities/alerta-critica.entity';
import { RedisService } from '@/modules/cola/services/redis.service';
import { TriageEventPublisher } from '@/modules/eventos/publishers/triage-event.publisher';

@Injectable()
export class AlertaCriticaService {
  private readonly logger = new Logger(AlertaCriticaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventPublisher: TriageEventPublisher,
  ) {}

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
        alerta: alertaExistente as AlertaCritica,
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
        medico_asignado_id: dto.medico_asignado_id,
        confirmada: false,
        escalada: false,
        activa: true,
      },
      include: {
        turnos: {
          include: {
            pacientes: {
              include: {
                usuarios: true,
              },
            },
            nivel_triage: true,
          },
        },
      },
    });

    this.logger.log(`Alerta creada: ${alerta.id}`);

    await this.publicarAlertaRedis(alerta);

    const medicosNotificados = await this.obtenerMedicosDisponibles(
      dto.hospital_id,
      dto.medico_asignado_id,
    );

    // 5. TODO: Emitir GraphQL Subscription (se hace en resolver)
    await this.eventPublisher.publishAlertaCritica({
      alerta_id: alerta.id,
      turno_id: dto.turno_id,
      hospital_id: dto.hospital_id,
      paciente_id: alerta.turnos.paciente_id,
      nivel_triage: dto.nivel_triage,
      tipo_alerta: dto.tipo_alerta,
      medico_asignado_id: dto.medico_asignado_id,
    });

    return {
      alerta: alerta as AlertaCritica,
      mensaje: `Alerta crítica creada - Nivel ${dto.nivel_triage}`,
      notificado_a: medicosNotificados,
    };
  }

  /**
   * Confirma una alerta (médico acepta atender)
   */
  async confirmarAlerta(dto: ConfirmarAlertaDto): Promise<AlertaCritica> {
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

    this.logger.log(`Alerta confirmada por médico ${dto.medico_id}`);

    await this.publicarAlertaConfirmada(alertaActualizada);

    return alertaActualizada as AlertaCritica;
  }

  /**
   * Obtiene una alerta por ID
   */
  async obtenerPorId(id: string): Promise<AlertaCritica> {
    const alerta = await this.prisma.alertas_criticas.findUnique({
      where: { id },
      include: {
        turnos: {
          include: {
            pacientes: {
              include: {
                usuarios: true,
              },
            },
            nivel_triage: true,
          },
        },
      },
    });

    if (!alerta) {
      throw new NotFoundException('Alerta no encontrada');
    }

    return alerta as AlertaCritica;
  }

  /**
   * Obtiene todas las alertas activas de un hospital
   */
  async obtenerAlertasActivas(hospitalId: number): Promise<AlertaCritica[]> {
    const alertas = await this.prisma.alertas_criticas.findMany({
      where: {
        hospital_id: hospitalId,
        activa: true,
      },
      include: {
        turnos: {
          include: {
            pacientes: {
              include: {
                usuarios: true,
              },
            },
            nivel_triage: true,
          },
        },
      },
      orderBy: {
        creado_en: 'asc',
      },
    });

    return alertas as AlertaCritica[];
  }

  /**
   * Obtiene alertas pendientes de confirmación (para cron de escalamiento)
   */
  async obtenerAlertasPendientesEscalamiento(): Promise<AlertaCritica[]> {
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

    return alertas as AlertaCritica[];
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


  /**
   * Publica alerta en Redis Pub/Sub
   */
  private async publicarAlertaRedis(alerta: any): Promise<void> {
    const channel = `hospital:${alerta.hospital_id}:alerta:critica`;
    const mensaje = JSON.stringify({
      alerta_id: alerta.id,
      turno_id: alerta.turno_id,
      nivel_triage: alerta.nivel_triage,
      tipo_alerta: alerta.tipo_alerta,
      timestamp: new Date().toISOString(),
    });

    await this.redis.publish(channel, mensaje);
  }

  /**
   * Publica confirmación de alerta en Redis
   */
  private async publicarAlertaConfirmada(alerta: any): Promise<void> {
    const channel = `hospital:${alerta.hospital_id}:alerta:confirmada`;
    const mensaje = JSON.stringify({
      alerta_id: alerta.id,
      turno_id: alerta.turno_id,
      confirmada_por: alerta.confirmada_por,
      timestamp: new Date().toISOString(),
    });

    await this.redis.publish(channel, mensaje);
  }

  /**
   * Obtiene médicos disponibles en el hospital
   */
  private async obtenerMedicosDisponibles(
    hospitalId: number,
    medicoAsignadoId?: string,
  ): Promise<string[]> {
    const medicos = await this.prisma.medicos.findMany({
      where: {
        activo: true,
        hospital_usuario: {
          some: {
            hospital_id: hospitalId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    return medicos.map(m => m.id);
  }
}