// src/modules/dashboard/dto/dashboard-enfermero.dto.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';
import { Turno } from '@/modules/turnos/entities/turno.entity';

@ObjectType()
export class MetricasDiaEnfermero {
  @Field(() => Int)
  total_atendidos: number;

  @Field(() => Int)
  por_nivel_1: number;

  @Field(() => Int)
  por_nivel_2: number;

  @Field(() => Int)
  por_nivel_3: number;

  @Field(() => Int)
  por_nivel_4: number;

  @Field(() => Int)
  por_nivel_5: number;

  @Field(() => Int)
  tiempo_promedio_espera: number;
}

@ObjectType()
export class DashboardEnfermero {
  @Field(() => [Turno])
  criticos: Turno[];

  @Field(() => [Turno])
  esperando_vitales: Turno[]; 

  @Field(() => [Turno])
  esperando_confirmacion: Turno[]; 

  @Field(() => MetricasDiaEnfermero)
  metricas_dia: MetricasDiaEnfermero;
}