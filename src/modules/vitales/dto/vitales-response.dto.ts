// src/modules/vitales/dto/vitales-response.dto.ts

import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { RegistroTriage } from '../entities/registro-triage.entity';

@ObjectType()
export class ResultadoClasificador {
  @Field(() => Int)
  nivel_sugerido: number;

  @Field(() => Float)
  confianza: number;

  @Field(() => Probabilidades)
  probabilidades: Probabilidades;

  @Field(() => [String])
  features_clave: string[];

  @Field(() => [String])
  alertas_vitales: string[];

  @Field()
  razon_clinica: string;

  @Field()
  modelo_version: string;
}

@ObjectType()
export class Probabilidades {
  @Field(() => Float)
  nivel_1: number;

  @Field(() => Float)
  nivel_2: number;

  @Field(() => Float)
  nivel_3: number;

  @Field(() => Float)
  nivel_4: number;

  @Field(() => Float)
  nivel_5: number;
}

@ObjectType()
export class VitalesResponse {
  @Field(() => RegistroTriage)
  registro_triage: RegistroTriage;

  @Field(() => ResultadoClasificador)
  resultado_clasificador: ResultadoClasificador;

  @Field()
  mensaje: string;

  @Field()
  siguiente_paso: string; // "TRIAGE_COMPLETO"

  @Field(() => [String])
  alertas_criticas: string[];
}