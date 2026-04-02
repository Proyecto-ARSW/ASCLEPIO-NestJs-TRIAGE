// src/modules/confirmacion/dto/confirmar-triage.dto.ts

import { IsUUID, IsInt, IsBoolean, IsOptional, IsString, Min, Max } from 'class-validator';
import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class ConfirmarTriageDto {
  @Field()
  @IsUUID()
  turno_id: string;

  @Field()
  @IsUUID()
  registro_triage_id: string;

  @Field()
  @IsUUID()
  enfermero_id: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(5)
  nivel_final_enfermero: number;

  @Field()
  @IsBoolean()
  acepto_sugerencia: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  razon_modificacion?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  tiempo_evaluacion_ms?: number;
}