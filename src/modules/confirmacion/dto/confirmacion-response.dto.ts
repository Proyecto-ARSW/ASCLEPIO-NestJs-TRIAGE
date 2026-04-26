// src/modules/confirmacion/dto/confirmacion-response.dto.ts

export class ConfirmacionResponseDto {
  id: string;
  registro_triage_id: string;
  enfermero_id: string;

  nivel_sugerido_ia: number;
  nivel_final_enfermero: number;

  acepto_sugerencia: boolean;
  razon_modificacion: string | null;

  tipo_modificacion: string | null;
  diferencia_niveles: number | null;

  tiempo_confirmacion_ms: number | null;

  creado_en: Date;
}