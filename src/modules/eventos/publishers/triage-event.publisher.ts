// src/modules/eventos/publishers/triage-event.publisher.ts

import { Injectable, Logger } from '@nestjs/common';
import { BasePublisher } from './base.publisher';
import {
  TriageEventType,
  TurnoCreadoPayload,
  CuestionarioCompletadoPayload,
  VitalesRegistradosPayload,
  TriageConfirmadoPayload,
  PacienteLlamadoPayload,
  PacienteAtendidoPayload,
  AlertaCriticaPayload,
  AlertaEscaladaPayload,
} from '../interfaces/eventos.interface';

@Injectable()
export class TriageEventPublisher extends BasePublisher {
  protected readonly logger = new Logger(TriageEventPublisher.name);

  /**
   * Publica evento: Turno creado
   */
  async publishTurnoCreado(payload: TurnoCreadoPayload): Promise<void> {
    await this.publish(TriageEventType.TURNO_CREADO, payload);
    this.logger.log(`Evento publicado: TURNO_CREADO - Turno: ${payload.numero_turno}`);
  }

  /**
   * Publica evento: Cuestionario completado
   */
  async publishCuestionarioCompletado(payload: CuestionarioCompletadoPayload): Promise<void> {
    await this.publish(TriageEventType.CUESTIONARIO_COMPLETADO, payload);
    this.logger.log(
      `Evento publicado: CUESTIONARIO_COMPLETADO - Nivel: ${payload.nivel_preliminar}`,
    );
  }

  /**
   * Publica evento: Vitales registrados
   */
  async publishVitalesRegistrados(payload: VitalesRegistradosPayload): Promise<void> {
    await this.publish(TriageEventType.VITALES_REGISTRADOS, payload);
    this.logger.log(
      `Evento publicado: VITALES_REGISTRADOS - Nivel: ${payload.nivel_sugerido_ia}`,
    );
  }

  /**
   * Publica evento: Triage confirmado
   */
  async publishTriageConfirmado(payload: TriageConfirmadoPayload): Promise<void> {
    await this.publish(TriageEventType.TRIAGE_CONFIRMADO, payload);
    this.logger.log(
      `Evento publicado: TRIAGE_CONFIRMADO - Nivel final: ${payload.nivel_final_enfermero}`,
    );
  }

  /**
   * Publica evento: Paciente llamado
   */
  async publishPacienteLlamado(payload: PacienteLlamadoPayload): Promise<void> {
    await this.publish(TriageEventType.PACIENTE_LLAMADO, payload);
    this.logger.log(
      `Evento publicado: PACIENTE_LLAMADO - Turno: ${payload.numero_turno}`,
    );
  }

  /**
   * Publica evento: Paciente atendido
   */
  async publishPacienteAtendido(payload: PacienteAtendidoPayload): Promise<void> {
    await this.publish(TriageEventType.PACIENTE_ATENDIDO, payload);
    this.logger.log(
      `Evento publicado: PACIENTE_ATENDIDO - Turno: ${payload.numero_turno}`,
    );
  }

  /**
   * Publica evento: Alerta crítica creada
   */
  async publishAlertaCritica(payload: AlertaCriticaPayload): Promise<void> {
    await this.publish(TriageEventType.ALERTA_CRITICA_CREADA, payload);
    this.logger.warn(
      `Evento publicado: ALERTA_CRITICA_CREADA - Nivel: ${payload.nivel_triage}`,
    );
  }

  /**
   * Publica evento: Alerta escalada
   */
  async publishAlertaEscalada(payload: AlertaEscaladaPayload): Promise<void> {
    await this.publish(TriageEventType.ALERTA_ESCALADA, payload);
    this.logger.warn(
      `Evento publicado: ALERTA_ESCALADA - Alerta: ${payload.alerta_id}`,
    );
  }

  /**
   * Publica evento: Turno cancelado
   */
  async publishTurnoCancelado(payload: { turno_id: string; hospital_id: number; razon: string }): Promise<void> {
    await this.publish(TriageEventType.TURNO_CANCELADO, payload);
    this.logger.log(`Evento publicado: TURNO_CANCELADO - Turno: ${payload.turno_id}`);
  }
}