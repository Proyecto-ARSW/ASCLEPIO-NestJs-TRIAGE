// src/modules/turnos/dto/llamar-paciente.dto.ts

import { IsUUID, IsString } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class LlamarPacienteDto {
  @Field()
  @IsUUID()
  medico_id: string;

  @Field()
  @IsString()
  consultorio: string;
}