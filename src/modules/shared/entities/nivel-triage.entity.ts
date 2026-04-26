// src/modules/shared/entities/nivel-triage.entity.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class NivelTriage {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  nivel: number;

  @Field()
  nombre: string;

  @Field({ nullable: true })
  descripcion?: string;

  @Field(() => Int)
  tiempo_max_espera_min: number;

  @Field({ nullable: true })
  color_codigo?: string;

  @Field()
  activo: boolean;
}