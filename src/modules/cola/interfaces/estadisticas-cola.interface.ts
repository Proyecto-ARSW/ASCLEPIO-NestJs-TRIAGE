// src/modules/cola/interfaces/estadisticas-cola.interface.ts

export interface EstadisticasCola {
  hospital_id: number;
  total_en_cola: number;
  por_nivel: {
    nivel_1: number;
    nivel_2: number;
    nivel_3: number;
    nivel_4: number;
    nivel_5: number;
  };
  tiempo_espera_promedio_min: number;
  tiempo_espera_maximo_min: number;
  alertas_activas: number;
  tendencia_ultima_hora: {
    ingresos: number;
    atendidos: number;
    promedio_atencion_min: number;
  };
}