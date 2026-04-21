// src/modules/alertas/dto/escalar-alerta.dto.ts

import { IsUUID, IsString } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class EscalarAlertaDto {
  @Field()
  @IsUUID()
  alerta_id: string;

  @Field()
  @IsUUID()
  jefe_guardia_id: string;

  @Field()
  @IsString()
  razon_escalamiento: string;
}