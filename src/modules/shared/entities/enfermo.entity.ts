// src/modules/shared/entities/enfermero.entity.ts

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Enfermero {
  @Field()
  id: string;

  @Field()
  usuario_id: string;

  @Field()
  numero_registro: string;

  @Field(() => Int)
  nivel_formacion_id: number;

  @Field(() => Int, { nullable: true })
  area_especializacion_id?: number;

  @Field()
  certificacion_triage: boolean;

  @Field({ nullable: true })
  fecha_certificacion?: Date;

  @Field()
  activo: boolean;

  @Field()
  creado_en: Date;
  
  @Field(() => Usuario, { nullable: true })
  usuario?: Usuario;

  @Field(() => Formacion, { nullable: true })
  formacion?: Formacion;
}