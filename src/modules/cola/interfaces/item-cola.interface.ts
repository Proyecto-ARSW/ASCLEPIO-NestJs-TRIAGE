// src/modules/cola/interfaces/item-cola.interface.ts

export interface ItemCola {
  turno_id: string;
  numero_turno: number;
  paciente_id: string;
  paciente_nombre: string;
  paciente_apellido: string;
  nivel_triage: number;
  tiempo_espera_minutos: number;
  prioridad_score: number;
  creado_en: string;
  alerta_critica: boolean;
}

export interface ColaResumen {
  nivel: number;
  total: number;
  tiempo_espera_promedio: number;
  items: ItemCola[];
}

export interface ColaPorHospital {
  hospital_id: number;
  hospital_nombre: string;
  total_en_espera: number;
  niveles: {
    [key: number]: ColaResumen;
  };
  actualizado_en: string;
}