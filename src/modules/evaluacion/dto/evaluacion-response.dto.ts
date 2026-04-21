// src/modules/evaluacion/dto/evaluacion-response.dto.ts

export class EvaluacionResponseDto {
  id: string;
  paciente_id: string;
  hospital_id: number;
  turno_id: string;
  
  sintomas: string[];
  embarazo: boolean;
  antecedentes: string[];
  posibles_causas: string[];
  
  nivel_prioridad: number;
  comentario_paciente: string | null;
  comentarios_ia: string | null;
  advertencia_ia: string | null;
  
  confidence_score: number | null;
  procedure_id: string | null;
  status: string | null;
  
  creado_en: Date;
  actualizado_en: Date;
}