// src/modules/turnos/dto/turno-response.dto.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';
import { Turno } from '../entities/turno.entity';

@ObjectType()
export class TurnoResponse {
  @Field(() => Turno)
  turno: Turno;

  @Field({ nullable: true })
  mensaje?: string;

  @Field(() => Int, { nullable: true })
  posicion_cola?: number;
}