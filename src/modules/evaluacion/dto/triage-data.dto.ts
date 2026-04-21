// src/modules/evaluacion/dto/triage-data.dto.ts

import { IsString, IsBoolean, IsArray, IsInt, Min, Max, IsOptional } from 'class-validator';

export class TriageDataDto {
  @IsString()
  idpaciente: string;

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
  posiblesCausas: string[];

  @IsString()
  @IsOptional()
  comentario?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  nivelPrioridad: number;

  @IsString()
  @IsOptional()
  comentariosIA?: string;

  @IsString()
  @IsOptional()
  advertenciaIA?: string;
}