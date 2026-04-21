// src/modules/turnos/dto/crear-turno-urgencia.dto.ts

import { IsUUID, IsInt } from 'class-validator';
import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CrearTurnoUrgenciaDto {
  @Field()
  @IsUUID()
  paciente_id: string;

  @Field(() => Int)
  @IsInt()
  hospital_id: number;
}