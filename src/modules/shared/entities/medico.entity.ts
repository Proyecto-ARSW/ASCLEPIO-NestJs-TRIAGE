// src/modules/shared/entities/medico.entity.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class Medico {
  @Field()
  id: string;

  @Field()
  usuario_id: string;

  @Field(() => Int)
  especialidad_id: number;

  @Field()
  numero_registro: string;

  @Field({ nullable: true })
  consultorio?: string;

  @Field()
  activo: boolean;

  @Field()
  creado_en: Date;
}