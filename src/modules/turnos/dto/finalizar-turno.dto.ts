// src/modules/turnos/dto/finalizar-turno.dto.ts

import { IsUUID, IsString, IsOptional } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@InputType()
export class FinalizarTurnoDto {
  @ApiProperty({
    description: 'ID UUID del médico que finaliza el turno',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @Field()
  @IsUUID()
  medico_id: string;

  @ApiProperty({
    description: 'Diagnóstico del paciente',
    example: 'Hipertensión arterial leve',
  })
  @Field()
  @IsString()
  diagnostico: string;

  @ApiProperty({
    description: 'Tratamiento indicado',
    example: 'Reposo, antihipertensivos y control en 7 días',
  })
  @Field()
  @IsString()
  tratamiento: string;

  @ApiPropertyOptional({
    description: 'Observaciones adicionales',
    example: 'Paciente refiere cefalea persistente',
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
