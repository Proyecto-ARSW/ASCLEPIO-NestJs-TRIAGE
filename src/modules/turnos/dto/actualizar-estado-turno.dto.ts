// src/modules/turnos/dto/actualizar-estado-turno.dto.ts

import { IsEnum } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { EstadoTurno } from '../entities/turno.entity';

@InputType()
export class ActualizarEstadoTurnoDto {
  @ApiProperty({
    description: 'Nuevo estado del turno',
    enum: EstadoTurno,
    example: EstadoTurno.EN_ESPERA,
  })
  @Field(() => EstadoTurno)
  @IsEnum(EstadoTurno)
  estado: EstadoTurno;
}
