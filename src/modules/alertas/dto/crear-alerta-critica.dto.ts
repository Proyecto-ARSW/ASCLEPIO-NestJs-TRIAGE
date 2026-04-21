// src/modules/alertas/dto/crear-alerta-critica.dto.ts

import { IsUUID, IsInt, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { Field, InputType, Int } from '@nestjs/graphql';
import { TipoAlerta } from '../entities/alerta-critica.entity';

@InputType()
export class CrearAlertaCriticaDto {
  @Field()
  @IsUUID()
  turno_id: string;

  @Field(() => Int)
  @IsInt()
  hospital_id: number;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(2)
  nivel_triage: number;

  @Field(() => TipoAlerta)
  @IsEnum(TipoAlerta)
  tipo_alerta: TipoAlerta;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  medico_asignado_id?: string;
}