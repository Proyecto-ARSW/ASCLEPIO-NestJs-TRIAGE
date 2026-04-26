// src/modules/turnos/dto/llamar-paciente.dto.ts

import { IsUUID, IsString } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

@InputType()
export class LlamarPacienteDto {
  @ApiProperty({
    description: 'ID UUID del médico que llama al paciente',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @Field()
  @IsUUID()
  medico_id: string;

  @ApiProperty({
    description: 'Número o nombre del consultorio',
    example: 'Consultorio 3',
  })
  @Field()
  @IsString()
  consultorio: string;
}
