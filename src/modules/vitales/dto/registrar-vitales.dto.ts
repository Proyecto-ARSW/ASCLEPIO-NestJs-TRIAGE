// src/modules/vitales/dto/registrar-vitales.dto.ts

import { IsUUID, IsInt, Min, Max, IsNumber, IsString, IsOptional, IsDecimal } from 'class-validator';
import { Type } from 'class-transformer';

export class RegistrarVitalesDto {
  @IsUUID()
  turno_id: string;

  @IsUUID()
  paciente_id: string;

  @IsInt()
  hospital_id: number;

  @IsUUID()
  enfermero_id: string;

  
  @IsInt()
  @Min(50)
  @Max(250)
  presion_sistolica: number;

  @IsInt()
  @Min(30)
  @Max(150)
  presion_diastolica: number;

  @IsInt()
  @Min(30)
  @Max(250)
  frecuencia_cardiaca: number;

  @IsInt()
  @Min(8)
  @Max(60)
  frecuencia_respiratoria: number;

  @IsNumber()
  @Type(() => Number)
  @Min(32)
  @Max(45)
  temperatura: number;

  @IsInt()
  @Min(50)
  @Max(100)
  saturacion_oxigeno: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(20)
  @Max(300)
  peso_kg?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(250)
  altura_cm?: number;

  // ============================================
  // CAMPOS ADICIONALES
  // ============================================

  @IsString()
  motivo_consulta: string;

  @IsOptional()
  @IsString()
  sintomas_observados?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}