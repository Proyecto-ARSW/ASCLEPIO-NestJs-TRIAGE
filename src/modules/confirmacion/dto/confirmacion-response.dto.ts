// src/modules/confirmacion/dto/confirmacion-response.dto.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';
import { ConfirmacionEnfermero } from '../entities/confirmacion-enfermero.entity';

@ObjectType()
export class ConfirmacionResponse {
  @Field(() => ConfirmacionEnfermero)
  confirmacion: ConfirmacionEnfermero;

  @Field()
  mensaje: string;

  @Field()
  siguiente_paso: string; 

  @Field(() => Int)
  posicion_en_cola: number;

  @Field()
  alerta_critica: boolean;
}