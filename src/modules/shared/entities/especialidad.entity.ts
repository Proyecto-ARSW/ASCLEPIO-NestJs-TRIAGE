// src/modules/shared/entities/especialidad.entity.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class Especialidad {
  @Field(() => Int)
  id: number;

  @Field()
  nombre: string;

  @Field({ nullable: true })
  descripcion?: string;
}