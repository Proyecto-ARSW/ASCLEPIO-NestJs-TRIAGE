// src/modules/vitales/dto/registrar-vitales.dto.ts

import { IsUUID, IsInt, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Field, InputType, Int, Float } from '@nestjs/graphql';

@InputType()
export class RegistrarVitalesDto {
  @Field()
  @IsUUID()
  turno_id: string;

  @Field()
  @IsUUID()
  cuestionario_id: string;

  @Field()
  @IsUUID()
  enfermero_id: string;

  @Field()
  @IsUUID()
  paciente_id: string;

  // Datos vitales
  @Field(() => Int)
  @IsInt()
  @Min(50)
  @Max(250)
  presion_sistolica: number;

  @Field(() => Int)
  @IsInt()
  @Min(30)
  @Max(150)
  presion_diastolica: number;

  @Field(() => Int)
  @IsInt()
  @Min(30)
  @Max(220)
  frecuencia_cardiaca: number;

  @Field(() => Int)
  @IsInt()
  @Min(8)
  @Max(60)
  frecuencia_respiratoria: number;

  @Field(() => Float)
  @IsNumber()
  @Min(35)
  @Max(42)
  temperatura: number;

  @Field(() => Int)
  @IsInt()
  @Min(70)
  @Max(100)
  saturacion_oxigeno: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  tiempo_registro_ms?: number;
}