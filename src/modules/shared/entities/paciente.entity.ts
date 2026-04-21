// src/modules/shared/entities/paciente.entity.ts

import { Field, ObjectType } from '@nestjs/graphql';
import { Usuario } from './usuario.entity';

@ObjectType()
export class Paciente {
  @Field()
  id: string;

  @Field()
  usuario_id: string;

  @Field({ nullable: true })
  fecha_nacimiento?: Date;

  @Field({ nullable: true })
  tipo_sangre?: string;

  @Field({ nullable: true })
  numero_documento?: string;

  @Field({ nullable: true })
  tipo_documento?: string;

  @Field({ nullable: true })
  eps?: string;

  @Field({ nullable: true })
  alergias?: string;

  @Field()
  creado_en: Date;

  // Relación
  @Field(() => Usuario, { nullable: true })
  usuario?: Usuario;
}