// src/modules/eventos/publishers/triage-event.publisher.ts

import { Injectable, Logger } from '@nestjs/common';
import { BasePublisher } from './base.publisher';
import {
  TriageEventType,
  TurnoCreadoPayload,
  EvaluacionCompletadaPayload,
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
   * Publica evento: Evaluación preliminar completada (Ollama)
   */
  async publishEvaluacionCompletada(payload: EvaluacionCompletadaPayload): Promise<void> {
    await this.publish(TriageEventType.CLASIFICACION_COMPLETADA, payload);
    this.logger.log(
      `Evento publicado: EVALUACION_COMPLETADA - Turno: ${payload.turno_id}, Nivel: ${payload.nivel_prioridad}`,
    );
  }

  /**
   * Publica evento: Vitales registrados (Random Forest)
   */
  async publishVitalesRegistrados(payload: VitalesRegistradosPayload): Promise<void> {
    await this.publish(TriageEventType.VITALES_REGISTRADOS, payload);
    this.logger.log(
      `Evento publicado: VITALES_REGISTRADOS - Nivel IA: ${payload.nivel_sugerido_ia}`,
    );
  }

  /**
   * Publica evento: Triage confirmado por enfermero
   */
  async publishTriageConfirmado(payload: TriageConfirmadoPayload): Promise<void> {
    await this.publish(TriageEventType.TRIAGE_CONFIRMADO, payload);
    this.logger.log(
      `Evento publicado: TRIAGE_CONFIRMADO - Nivel final: ${payload.nivel_final_enfermero}`,
    );
  }

  /**
   * Publica evento: Paciente llamado por médico
   */
  async publishPacienteLlamado(payload: PacienteLlamadoPayload): Promise<void> {
    await this.publish(TriageEventType.PACIENTE_LLAMADO, payload);
    this.logger.log(
      `Evento publicado: PACIENTE_LLAMADO - Turno: ${payload.numero_turno} → Consultorio: ${payload.consultorio}`,
    );
  }

  /**
   * Publica evento: Paciente atendido (turno finalizado)
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
      `Evento publicado: ALERTA_CRITICA_CREADA - Nivel: ${payload.nivel_triage}, Tipo: ${payload.tipo_alerta}`,
    );
  }

  /**
   * Publica evento: Alerta escalada a jefe de guardia
   */
  async publishAlertaEscalada(payload: AlertaEscaladaPayload): Promise<void> {
    await this.publish(TriageEventType.ALERTA_ESCALADA, payload);
    this.logger.warn(
      `Evento publicado: ALERTA_ESCALADA - Alerta: ${payload.alerta_id}, Razón: ${payload.razon_escalamiento}`,
    );
  }

  /**
   * Publica evento: Turno cancelado
   */
  async publishTurnoCancelado(payload: {
    turno_id: string;
    hospital_id: number;
    razon: string;
  }): Promise<void> {
    await this.publish(TriageEventType.TURNO_CANCELADO, payload);
    this.logger.log(`Evento publicado: TURNO_CANCELADO - Turno: ${payload.turno_id}`);
  }
}