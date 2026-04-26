// src/modules/alertas/dto/alerta-response.dto.ts

import { Field, ObjectType } from '@nestjs/graphql';
import { AlertaCritica } from '../entities/alerta-critica.entity';

@ObjectType()
export class AlertaResponse {
  @Field(() => AlertaCritica)
  alerta: AlertaCritica;

  @Field()
  mensaje: string;

  @Field()
  notificado_a: string[];
}