// src/modules/vitales/dto/vitales-response.dto.ts

export class VitalesResponseDto {
  id: string;
  paciente_id: string;
  hospital_id: number;
  enfermero_id: string;
  evaluacion_preliminar_id: string;

  // Vitales
  presion_sistolica: number;
  presion_diastolica: number;
  frecuencia_cardiaca: number;
  frecuencia_respiratoria: number;
  temperatura: number;
  saturacion_oxigeno: number;
  peso_kg: number | null;
  altura_cm: number | null;

  // Campos calculados
  presion_arterial_media: number | null;
  shock_index: number | null;
  tiene_alertas_vitales: boolean;

  // Clasificación IA
  nivel_sugerido_ia: number;
  confiancia_ia: number;
  comentarios_ia: string | null;
  probabilidad_nivel_1: number | null;
  probabilidad_nivel_2: number | null;
  probabilidad_nivel_3: number | null;
  probabilidad_nivel_4: number | null;
  probabilidad_nivel_5: number | null;

  // Info adicional
  motivo_consulta: string;
  sintomas_observados: string | null;
  observaciones: string | null;

  creado_en: Date;
}