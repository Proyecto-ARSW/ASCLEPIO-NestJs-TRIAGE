// src/modules/alertas/dto/confirmar-alerta.dto.ts

import { IsUUID } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

@InputType()
export class ConfirmarAlertaDto {
  @ApiProperty({ description: 'ID UUID de la alerta a confirmar', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @Field()
  @IsUUID()
  alerta_id: string;

  @ApiProperty({ description: 'ID UUID del médico que confirma la alerta', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  @Field()
  @IsUUID()
  medico_id: string;
}
