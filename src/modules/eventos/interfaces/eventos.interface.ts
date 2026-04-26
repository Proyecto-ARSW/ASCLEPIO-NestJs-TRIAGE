// src/modules/eventos/interfaces/eventos.interface.ts

/**
 * Eventos que PUBLICA asclepio-triage
 */
export enum TriageEventType {
  TURNO_CREADO = 'triage.turno.creado',
  TURNO_CANCELADO = 'triage.turno.cancelado',
  CLASIFICACION_COMPLETADA = 'triage.clasificacion.completada',
  VITALES_REGISTRADOS = 'triage.vitales.registrados',
  TRIAGE_CONFIRMADO = 'triage.confirmado',
  PACIENTE_LLAMADO = 'triage.paciente.llamado',
  PACIENTE_ATENDIDO = 'triage.paciente.atendido',
  ALERTA_CRITICA_CREADA = 'triage.alerta.critica.creada',
  ALERTA_ESCALADA = 'triage.alerta.escalada',
  METRICAS_IA_ACTUALIZADAS = 'triage.metricas.ia.actualizadas',
}

/**
 * Eventos que CONSUME asclepio-triage (de otros microservicios)
 */
export enum CoreEventType {
  PACIENTE_CREADO = 'core.paciente.creado',
  PACIENTE_ACTUALIZADO = 'core.paciente.actualizado',
  MEDICO_ASIGNADO = 'core.medico.asignado',
  HISTORIAL_CREADO = 'core.historial.creado',
}

export enum FarmaciaEventType {
  ORDEN_CREADA = 'farmacia.orden.creada',
  ORDEN_ENTREGADA = 'farmacia.orden.entregada',
}

/**
 * Opciones de configuración para consumo de mensajes
 */
export interface ConsumeOptions {
  prefetchCount: number;
  noAck: boolean;
}

/**
 * Opciones de configuración para publicación de mensajes
 */
export interface PublishOptions {
  persistent?: boolean;
  expiration?: string;
  priority?: number;
}

/**
 * Estructura base de un evento
 */
export interface BaseEvent<T = any> {
  event_type: string;
  event_id: string;
  timestamp: string;
  service: string;
  version: string;
  payload: T;
  metadata?: {
    correlation_id?: string;
    causation_id?: string;
    user_id?: string;
    hospital_id?: number;
  };
}

/**
 * Payloads específicos de eventos de triage
 */
export interface TurnoCreadoPayload {
  turno_id: string;
  numero_turno: number;
  hospital_id: number;
  paciente_id: string;
  tipo_turno: string;
  estado: string;
  fecha: string;
}

export interface EvaluacionCompletadaPayload {
  evaluacion_id: string;
  turno_id: string;
  nivel_prioridad: number;
  hospital_id: number;
  paciente_id: string;
  sintomas: string[];
}

export interface CuestionarioCompletadoPayload {
  turno_id: string;
  cuestionario_id: string;
  paciente_id: string;
  hospital_id: number;
  categoria_molestia: string;
  nivel_preliminar: number;
  requirio_ollama: boolean;
  sintomas_detectados: string[];
}

export interface VitalesRegistradosPayload {
  turno_id: string;
  registro_triage_id: string;
  cuestionario_id: string;
  paciente_id: string;
  hospital_id: number;
  enfermero_id: string;
  nivel_sugerido_ia: number;
  confianza_ia: number;
  vitales: {
    presion_sistolica: number;
    presion_diastolica: number;
    frecuencia_cardiaca: number;
    frecuencia_respiratoria: number;
    temperatura: number;
    saturacion_oxigeno: number;
  };
  alertas_vitales: string[];
}

export interface TriageConfirmadoPayload {
  turno_id: string;
  confirmacion_id: string;
  registro_triage_id: string;
  paciente_id: string;
  hospital_id: number;
  enfermero_id: string;
  nivel_sugerido_ollama: number;
  nivel_final_enfermero: number;
  acepto_sugerencia: boolean;
  razon_modificacion?: string;
  posicion_cola: number;
}

export interface PacienteLlamadoPayload {
  turno_id: string;
  numero_turno: number;
  hospital_id: number;
  paciente_id: string;
  medico_id: string;
  consultorio: string;
  nivel_triage: number;
  tiempo_espera_minutos: number;
}

export interface PacienteAtendidoPayload {
  turno_id: string;
  numero_turno: number;
  hospital_id: number;
  paciente_id: string;
  medico_id: string;
  nivel_triage: number;
  tiempo_espera_minutos: number;
  tiempo_atencion_minutos: number;
  diagnostico: string;
  tratamiento: string;
  observaciones?: string;
}

export interface AlertaCriticaPayload {
  alerta_id: string;
  turno_id: string;
  hospital_id: number;
  paciente_id: string;
  nivel_triage: number;
  tipo_alerta: string;
  medico_asignado_id?: string;
}

export interface AlertaEscaladaPayload {
  alerta_id: string;
  turno_id: string;
  hospital_id: number;
  jefe_guardia_id: string;
  razon_escalamiento: string;
  tiempo_sin_confirmar_min: number;
  nivel_triage: number;
}

/**
 * Payloads de eventos que CONSUME asclepio-triage
 */
export interface PacienteCreadoPayload {
  paciente_id: string;
  usuario_id: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento?: string;
  tipo_sangre?: string;
  eps?: string;
}

export interface MedicoAsignadoPayload {
  medico_id: string;
  hospital_id: number;
  especialidad_id: number;
  consultorio?: string;
}