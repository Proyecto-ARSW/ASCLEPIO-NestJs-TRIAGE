// src/modules/turnos/dto/finalizar-turno.dto.ts

import { IsUUID, IsString } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class FinalizarTurnoDto {
  @Field()
  @IsUUID()
  medico_id: string;

  @Field()
  @IsString()
  diagnostico: string;

  @Field()
  @IsString()
  tratamiento: string;

  @Field({ nullable: true })
  @IsString()
  observaciones?: string;
}