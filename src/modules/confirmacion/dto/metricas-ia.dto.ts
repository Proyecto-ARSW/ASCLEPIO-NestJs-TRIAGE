// src/modules/confirmacion/dto/metricas-ia.dto.ts

import { Field, ObjectType, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class MetricasIA {
  @Field(() => Int)
  total_evaluaciones: number;

  @Field(() => Int)
  total_aceptadas: number;

  @Field(() => Int)
  total_modificadas: number;

  @Field(() => Float)
  tasa_aceptacion: number;

  @Field(() => Float)
  precision_nivel_1: number;

  @Field(() => Float)
  precision_nivel_2: number;

  @Field(() => Float)
  precision_nivel_3: number;

  @Field(() => Float)
  precision_nivel_4: number;

  @Field(() => Float)
  precision_nivel_5: number;

  @Field(() => Float)
  precision_general: number;

  @Field(() => Int)
  escalamientos: number;

  @Field(() => Int)
  degradaciones: number;

  @Field()
  periodo_inicio: Date;

  @Field()
  periodo_fin: Date;
}

@ObjectType()
export class MetricasEnfermero {
  @Field()
  enfermero_id: string;

  @Field()
  nombre_completo: string;

  @Field(() => Int)
  evaluaciones_realizadas: number;

  @Field(() => Float)
  tasa_aceptacion_ia: number;

  @Field(() => Float)
  tiempo_promedio_evaluacion_seg: number;

  @Field(() => Int)
  escalamientos_realizados: number;

  @Field()
  periodo: string;
}