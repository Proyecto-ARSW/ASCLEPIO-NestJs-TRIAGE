// src/modules/turnos/dto/actualizar-estado-turno.dto.ts

import { IsEnum } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';
import { EstadoTurno } from '../entities/turno.entity';

@InputType()
export class ActualizarEstadoTurnoDto {
  @Field(() => EstadoTurno)
  @IsEnum(EstadoTurno)
  estado: EstadoTurno;
}