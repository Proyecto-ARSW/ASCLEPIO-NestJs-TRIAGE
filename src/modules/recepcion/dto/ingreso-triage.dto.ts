import {
  IsString, IsNumber, IsUUID, IsArray, IsBoolean,
  IsOptional, Min, Max, ValidateNested,
} from 'class-validator';

export class IngresoTriageDto {
  // Identificación
  @IsUUID()
  paciente_id: string;

  @IsNumber()
  hospital_id: number;

  @IsUUID()
  enfermero_id: string;

  // Síntomas (de ISISvoice)
  @IsString()
  motivo_consulta: string;

  @IsArray()
  @IsString({ each: true })
  sintomas: string[];

  @IsBoolean()
  embarazo: boolean;

  @IsArray()
  @IsString({ each: true })
  antecedentes: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  posibles_causas?: string[];

  @IsNumber()
  @Min(1)
  @Max(5)
  nivel_preliminar_isisvoice: number;

  @IsString()
  @IsOptional()
  comentario_paciente?: string;

  // Signos vitales (del enfermero via ISISvoice)
  @IsNumber()
  presion_sistolica: number;

  @IsNumber()
  presion_diastolica: number;

  @IsNumber()
  frecuencia_cardiaca: number;

  @IsNumber()
  frecuencia_respiratoria: number;

  @IsNumber()
  temperatura: number;

  @IsNumber()
  saturacion_oxigeno: number;

  @IsNumber()
  @IsOptional()
  peso_kg?: number;

  @IsNumber()
  @IsOptional()
  altura_cm?: number;

  // Observaciones enfermero
  @IsString()
  @IsOptional()
  observaciones_enfermero?: string;
}
