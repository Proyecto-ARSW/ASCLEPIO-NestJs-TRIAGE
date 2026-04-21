// src/modules/shared/entities/formacion.entity.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class Formacion {
  @Field(() => Int)
  id: number;

  @Field()
  nombre: string;

  @Field({ nullable: true })
  descripcion?: string;
}