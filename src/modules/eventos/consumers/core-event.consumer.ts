// src/modules/eventos/consumers/core-event.consumer.ts

import { Injectable, Logger } from '@nestjs/common';
import { BaseConsumer } from './base.consumer';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BaseEvent,
  CoreEventType,
  PacienteCreadoPayload,
  MedicoAsignadoPayload,
} from '../interfaces/eventos.interface';

@Injectable()
export class CoreEventConsumer extends BaseConsumer {
  protected readonly logger = new Logger(CoreEventConsumer.name);

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super(configService);
  }

  /**
   * Routing keys de eventos que consume asclepio-triage
   */
  protected getRoutingKeys(): string[] {
    return [
      CoreEventType.PACIENTE_CREADO,
      CoreEventType.PACIENTE_ACTUALIZADO,
      CoreEventType.MEDICO_ASIGNADO,
      // 'farmacia.*', // Escuchar todos los eventos de farmacia
    ];
  }

  /**
   * Maneja eventos recibidos
   */
  protected async handleEvent(event: BaseEvent): Promise<void> {
    switch (event.event_type) {
      case CoreEventType.PACIENTE_CREADO:
        await this.handlePacienteCreado(event.payload);
        break;

      case CoreEventType.PACIENTE_ACTUALIZADO:
        await this.handlePacienteActualizado(event.payload);
        break;

      case CoreEventType.MEDICO_ASIGNADO:
        await this.handleMedicoAsignado(event.payload);
        break;

      default:
        this.logger.debug(`Evento no manejado: ${event.event_type}`);
    }
  }

  /**
   * Handler: Paciente creado en asclepio-core
   */
  private async handlePacienteCreado(payload: PacienteCreadoPayload): Promise<void> {
    this.logger.log(`Paciente creado: ${payload.nombre} ${payload.apellido}`);

    // TODO: Sincronizar datos del paciente si es necesario
    // Por ahora, asclepio-triage lee pacientes directamente de la BD compartida
    
    // Ejemplo: Enviar notificación de bienvenida al paciente
    // await this.notificationService.sendWelcome(payload.paciente_id);
  }

  /**
   * Handler: Paciente actualizado
   */
  private async handlePacienteActualizado(payload: any): Promise<void> {
    this.logger.log(`Paciente actualizado: ${payload.paciente_id}`);
    
    // TODO: Invalidar caché, actualizar vistas, etc.
  }

  /**
   * Handler: Médico asignado a hospital
   */
  private async handleMedicoAsignado(payload: MedicoAsignadoPayload): Promise<void> {
    this.logger.log(
      `👨‍⚕️ Médico asignado: ${payload.medico_id} → Hospital: ${payload.hospital_id}`,
    );

    // TODO: Actualizar disponibilidad, notificar equipo, etc.
  }
}