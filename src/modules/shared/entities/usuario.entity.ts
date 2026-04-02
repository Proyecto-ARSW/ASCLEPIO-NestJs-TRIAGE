// src/modules/shared/entities/usuario.entity.ts

import { Field, ObjectType } from '@nestjs/graphql';

export enum RolUsuario {
  PACIENTE = 'PACIENTE',
  MEDICO = 'MEDICO',
  ADMIN = 'ADMIN',
  RECEPCIONISTA = 'RECEPCIONISTA',
  ENFERMERO = 'ENFERMERO',
  JEFE_GUARDIA = 'JEFE_GUARDIA',
}

@ObjectType()
export class Usuario {
  @Field()
  id: string;

  @Field()
  nombre: string;

  @Field()
  apellido: string;

  @Field()
  email: string;

  // NO exponer password_hash en GraphQL
  password_hash?: string;

  @Field()
  rol: RolUsuario;

  @Field({ nullable: true })
  telefono?: string;

  @Field()
  activo: boolean;

  @Field()
  creado_en: Date;

  @Field()
  actualizado_en: Date;

  // Computed field
  @Field()
  get nombre_completo(): string {
    return `${this.nombre} ${this.apellido}`;
  }
}