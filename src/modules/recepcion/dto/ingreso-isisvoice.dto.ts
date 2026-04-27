import {
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreliminaryHistoryISISvoiceDto {
  @IsArray()
  @IsString({ each: true })
  sintomas: string[];

  @IsBoolean()
  @IsOptional()
  embarazo?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  antecedentes?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  posiblesCausas?: string[];

  @IsString()
  @IsOptional()
  comentario?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  nivelPrioridad?: number;

  @IsString()
  @IsOptional()
  comentariosIA?: string;

  @IsString()
  @IsOptional()
  advertenciaIA?: string;
}

export class VitalSignsISISvoiceDto {
  @IsNumber()
  temperature_c: number;

  @IsNumber()
  heart_rate_bpm: number;

  @IsNumber()
  respiratory_rate_bpm: number;

  @IsNumber()
  systolic_bp_mmhg: number;

  @IsNumber()
  diastolic_bp_mmhg: number;

  @IsNumber()
  oxygen_saturation_pct: number;

  @IsNumber()
  @IsOptional()
  weight_kg?: number;

  @IsNumber()
  @IsOptional()
  height_cm?: number;
}

export class CommentISISvoiceDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsString()
  @IsOptional()
  created_at?: string;
}

export class IngresoISISvoiceDto {
  @ApiProperty({ example: '1032456789_20260406015148' })
  @IsString()
  procedure_id: string;

  @ApiProperty({ example: '1032456789', description: 'Cédula del paciente' })
  @IsString()
  patient_id: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  transcript?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  input_type?: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => PreliminaryHistoryISISvoiceDto)
  preliminary_history: PreliminaryHistoryISISvoiceDto;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  confidence_score?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => VitalSignsISISvoiceDto)
  vital_signs: VitalSignsISISvoiceDto;

  @ApiPropertyOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommentISISvoiceDto)
  @IsOptional()
  comments?: CommentISISvoiceDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  created_at?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  updated_at?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  webhook_delivery?: string;
}