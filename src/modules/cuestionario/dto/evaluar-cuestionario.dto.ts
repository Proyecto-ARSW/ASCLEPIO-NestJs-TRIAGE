// src/modules/cuestionario/dto/evaluar-cuestionario.dto.ts

import { IsUUID, IsInt, IsString, IsArray, ValidateNested, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Field, InputType, Int } from '@nestjs/graphql';
import { RespuestaDto } from './respuesta.dto';

export enum CategoriaMolestia {
  DOLOR = 'DOLOR',
  RESPIRATORIO = 'RESPIRATORIO',
  TRAUMA = 'TRAUMA',
  FIEBRE = 'FIEBRE',
  NEUROLOGICO = 'NEUROLOGICO',
  DIGESTIVO = 'DIGESTIVO',
  OTROS = 'OTROS',
}

@InputType()
export class EvaluarCuestionarioDto {
  @Field()
  @IsUUID()
  turno_id: string;

  @Field()
  @IsUUID()
  paciente_id: string;

  @Field(() => Int)
  @IsInt()
  hospital_id: number;

  @Field()
  @IsString()
  categoria: CategoriaMolestia;

  @Field(() => [RespuestaDto])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaDto)
  respuestas: RespuestaDto[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  motivo_texto_libre?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  tiempo_llenado_ms?: number;
}