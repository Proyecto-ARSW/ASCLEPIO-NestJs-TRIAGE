// src/modules/alertas/dto/escalar-alerta.dto.ts

import { IsUUID, IsString } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

@InputType()
export class EscalarAlertaDto {
  @ApiProperty({ description: 'ID UUID de la alerta a escalar', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @Field()
  @IsUUID()
  alerta_id: string;

  @ApiProperty({ description: 'ID UUID del jefe de guardia que recibe el escalamiento', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  @Field()
  @IsUUID()
  jefe_guardia_id: string;

  @ApiProperty({ description: 'Razón del escalamiento al jefe de guardia', example: 'Médico no disponible, situación crítica requiere atención inmediata' })
  @Field()
  @IsString()
  razon_escalamiento: string;
}
