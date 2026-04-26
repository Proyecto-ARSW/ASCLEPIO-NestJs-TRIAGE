// src/modules/alertas/dto/crear-alerta-critica.dto.ts

import { IsUUID, IsInt, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { Field, InputType, Int } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoAlerta } from '../entities/alerta-critica.entity';

@InputType()
export class CrearAlertaCriticaDto {
  @ApiProperty({ description: 'ID UUID del turno asociado', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @Field()
  @IsUUID()
  turno_id: string;

  @ApiProperty({ description: 'ID del hospital', example: 1 })
  @Field(() => Int)
  @IsInt()
  hospital_id: number;

  @ApiProperty({ description: 'Nivel de triage crítico (1=rojo, 2=naranja)', minimum: 1, maximum: 2, example: 1 })
  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(2)
  nivel_triage: number;

  @ApiProperty({ description: 'Tipo de alerta', enum: TipoAlerta, example: TipoAlerta.TRIAGE_CRITICO })
  @Field(() => TipoAlerta)
  @IsEnum(TipoAlerta)
  tipo_alerta: TipoAlerta;

  @ApiPropertyOptional({ description: 'ID UUID del médico asignado', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  medico_asignado_id?: string;
}
