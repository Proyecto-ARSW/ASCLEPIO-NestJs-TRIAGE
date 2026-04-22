// src/modules/turnos/dto/crear-turno-urgencia.dto.ts

import { IsUUID, IsInt } from 'class-validator';
import { Field, InputType, Int } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

@InputType()
export class CrearTurnoUrgenciaDto {
  @ApiProperty({
    description: 'ID UUID del paciente',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @Field()
  @IsUUID()
  paciente_id: string;

  @ApiProperty({
    description: 'ID del hospital',
    example: 1,
  })
  @Field(() => Int)
  @IsInt()
  hospital_id: number;
}
