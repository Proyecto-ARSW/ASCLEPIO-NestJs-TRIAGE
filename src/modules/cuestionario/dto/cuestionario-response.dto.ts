// src/modules/cuestionario/dto/cuestionario-response.dto.ts

import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { CuestionarioTriage } from '../entities/cuestionario-triage.entity';

@ObjectType()
export class ResultadoIAPreliminar {
  @Field(() => Int)
  nivel_sugerido: number;

  @Field(() => [String])
  sintomas_detectados: string[];

  @Field()
  razon_clinica: string;

  @Field(() => Float)
  confianza: number;

  @Field()
  requirio_ollama: boolean;
}

@ObjectType()
export class CuestionarioResponse {
  @Field(() => CuestionarioTriage)
  cuestionario: CuestionarioTriage;

  @Field(() => ResultadoIAPreliminar)
  resultado_ia: ResultadoIAPreliminar;

  @Field()
  mensaje: string;

  @Field()
  siguiente_paso: string;  

  @Field({ nullable: true })
  alerta_critica?: boolean; 
}