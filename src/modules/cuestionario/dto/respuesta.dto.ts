// src/modules/cuestionario/dto/respuesta.dto.ts

import { IsInt, IsString, Min, Max } from 'class-validator';
import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class RespuestaDto {
  @Field(() => Int)
  @IsInt()
  @Min(1)
  pregunta_id: number;

  @Field()
  @IsString()
  pregunta: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(5)
  valor: number;

  @Field()
  @IsString()
  texto: string;
}