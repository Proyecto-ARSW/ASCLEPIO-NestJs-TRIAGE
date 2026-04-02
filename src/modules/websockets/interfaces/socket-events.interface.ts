// src/modules/websockets/interfaces/socket-events.interface.ts

/**
 * Eventos que el servidor EMITE al cliente
 */
export enum ServerEvents {
  // Turnos
  TURNO_CREADO = 'turno:creado',
  TURNO_ACTUALIZADO = 'turno:actualizado',
  
  // Cuestionario
  CUESTIONARIO_COMPLETADO = 'cuestionario:completado',
  
  // Vitales
  VITALES_REGISTRADOS = 'vitales:registrados',
  
  // Confirmación
  TRIAGE_CONFIRMADO = 'triage:confirmado',
  
  // Cola
  COLA_ACTUALIZADA = 'cola:actualizada',
  POSICION_ACTUALIZADA = 'posicion:actualizada',
  
  // Llamados
  PACIENTE_LLAMADO = 'paciente:llamado',
  PANTALLA_LLAMAR = 'pantalla:llamar-paciente',
  
  // Atención
  PACIENTE_ATENDIDO = 'paciente:atendido',
  CONSULTA_INICIADA = 'consulta:iniciada',
  
  // Alertas
  ALERTA_CRITICA = 'alerta:critica',
  ALERTA_ESCALADA = 'alerta:escalada',
  
  // Sistema
  NOTIFICACION = 'notificacion',
  ERROR = 'error',
}

/**
 * Eventos que el cliente ENVÍA al servidor
 */
export enum ClientEvents {
  // Conexión
  JOIN_HOSPITAL = 'join:hospital',
  LEAVE_HOSPITAL = 'leave:hospital',
  
  // Dashboards
  JOIN_DASHBOARD_ENFERMERO = 'join:dashboard-enfermero',
  JOIN_DASHBOARD_MEDICO = 'join:dashboard-medico',
  
  // Pantalla de llamados
  JOIN_PANTALLA_LLAMADOS = 'join:pantalla-llamados',
  
  // Ping/Pong
  PING = 'ping',
}

/**
 * Payloads de eventos del servidor
 */
export interface TurnoEventPayload {
  turno_id: string;
  numero_turno: number;
  hospital_id: number;
  paciente_nombre: string;
  estado: string;
  timestamp: string;
}

export interface CuestionarioEventPayload {
  turno_id: string;
  cuestionario_id: string;
  nivel_preliminar: number;
  requirio_ollama: boolean;
  timestamp: string;
}

export interface VitalesEventPayload {
  turno_id: string;
  registro_triage_id: string;
  nivel_sugerido: number;
  confianza: number;
  alertas_vitales: string[];
  timestamp: string;
}

export interface TriageConfirmadoEventPayload {
  turno_id: string;
  confirmacion_id: string;
  nivel_final: number;
  acepto_sugerencia: boolean;
  posicion_cola: number;
  timestamp: string;
}

export interface ColaEventPayload {
  hospital_id: number;
  nivel_triage?: number;
  total_en_espera: number;
  timestamp: string;
}

export interface PacienteLlamadoEventPayload {
  turno_id: string;
  numero_turno: number;
  paciente_nombre: string;
  paciente_apellido: string;
  consultorio: string;
  medico_nombre: string;
  nivel_triage: number;
  timestamp: string;
}

export interface AlertaCriticaEventPayload {
  alerta_id: string;
  turno_id: string;
  numero_turno: number;
  paciente_nombre: string;
  nivel_triage: number;
  tipo_alerta: string;
  timestamp: string;
}

export interface NotificacionEventPayload {
  tipo: 'info' | 'warning' | 'error' | 'success';
  titulo: string;
  mensaje: string;
  timestamp: string;
}