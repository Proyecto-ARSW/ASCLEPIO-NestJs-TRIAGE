// src/modules/evaluacion/dto/guardar-evaluacion.dto.ts

import { IsString, IsNumber, Min, Max, IsUUID, ValidateNested, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { TriageDataDto } from './triage-data.dto';

export class GuardarEvaluacionDto {
  @IsString()
  procedure_id: string;

  @IsString()
  patient_cedula: string;

  @IsUUID()
  turno_id: string;

  @ValidateNested()
  @Type(() => TriageDataDto)
  triage_data: TriageDataDto;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence_score: number;

  @IsString()
  status: string;

  @IsOptional()
  @IsDateString()
  created_at?: string;

  @IsOptional()
  @IsDateString()
  updated_at?: string;
}