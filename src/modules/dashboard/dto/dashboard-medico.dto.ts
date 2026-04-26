// src/modules/dashboard/dto/dashboard-medico.dto.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';
import { Turno } from '@/modules/turnos/entities/turno.entity';
import { AlertaCritica } from '@/modules/alertas/entities/alerta-critica.entity';

@ObjectType()
export class TurnosPorNivel {
  @Field(() => [Turno])
  nivel_1: Turno[];

  @Field(() => [Turno])
  nivel_2: Turno[];

  @Field(() => [Turno])
  nivel_3: Turno[];

  @Field(() => [Turno])
  nivel_4: Turno[];

  @Field(() => [Turno])
  nivel_5: Turno[];
}

@ObjectType()
export class MetricasPersonalesMedico {
  @Field(() => Int)
  atendidos_hoy: number;

  @Field(() => Int)
  tiempo_promedio_atencion: number;

  @Field(() => Int)
  en_consulta_ahora: number;
}

@ObjectType()
export class DashboardMedico {
  @Field(() => TurnosPorNivel)
  por_niveles: TurnosPorNivel;

  @Field(() => [AlertaCritica])
  alertas_pendientes: AlertaCritica[];

  @Field(() => MetricasPersonalesMedico)
  metricas_personales: MetricasPersonalesMedico;
}