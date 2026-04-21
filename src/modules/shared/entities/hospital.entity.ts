// src/modules/shared/entities/hospital.entity.ts

import { Field, ObjectType, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class Hospital {
  @Field(() => Int)
  id: number;

  @Field()
  nombre: string;

  @Field({ nullable: true })
  nit?: string;

  @Field()
  departamento: string;

  @Field()
  ciudad: string;

  @Field()
  direccion: string;

  @Field({ nullable: true })
  telefono?: string;

  @Field({ nullable: true })
  email_contacto?: string;

  @Field({ nullable: true })
  tipo_institucion?: string;

  @Field(() => Int, { nullable: true })
  capacidad_urgencias?: number;

  @Field(() => Int, { nullable: true })
  numero_consultorios?: number;

  @Field()
  activo: boolean;

  @Field(() => Float, { nullable: true })
  latitud?: number;

  @Field(() => Float, { nullable: true })
  longitud?: number;

  @Field()
  creado_en: Date;

  @Field()
  actualizado_en: Date;
}