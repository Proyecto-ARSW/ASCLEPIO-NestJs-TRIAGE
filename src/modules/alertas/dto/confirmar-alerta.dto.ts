// src/modules/alertas/dto/confirmar-alerta.dto.ts

import { IsUUID } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ConfirmarAlertaDto {
  @Field()
  @IsUUID()
  alerta_id: string;

  @Field()
  @IsUUID()
  medico_id: string;
}