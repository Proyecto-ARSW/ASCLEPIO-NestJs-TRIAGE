// src/modules/dashboard/dto/dashboard-jefe-guardia.dto.ts

import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { AlertaCritica } from '@/modules/alertas/entities/alerta-critica.entity';

@ObjectType()
export class MetricasTiempoReal {
  @Field(() => Int)
  en_espera: number;

  @Field(() => Int)
  atendiendo: number;

  @Field(() => Int)
  atendidos: number;

  @Field(() => Int)
  cancelados: number;
}

@ObjectType()
export class DistribucionPorNivel {
  @Field(() => Int)
  nivel_1: number;

  @Field(() => Float)
  nivel_1_porcentaje: number;

  @Field(() => Int)
  nivel_2: number;

  @Field(() => Float)
  nivel_2_porcentaje: number;

  @Field(() => Int)
  nivel_3: number;

  @Field(() => Float)
  nivel_3_porcentaje: number;

  @Field(() => Int)
  nivel_4: number;

  @Field(() => Float)
  nivel_4_porcentaje: number;

  @Field(() => Int)
  nivel_5: number;

  @Field(() => Float)
  nivel_5_porcentaje: number;
}

@ObjectType()
export class TiemposPromedio {
  @Field(() => Int)
  cuestionario_a_vitales: number;

  @Field(() => Int)
  vitales_a_confirmacion: number;

  @Field(() => Int)
  confirmacion_a_llamado: number;

  @Field(() => Int)
  total_espera: number;

  @Field(() => Int)
  tiempo_atencion: number;
}

@ObjectType()
export class MiembroEquipo {
  @Field()
  id: string;

  @Field()
  nombre: string;

  @Field()
  rol: string;

  @Field()
  estado: string;

  @Field({ nullable: true })
  turno_actual?: string;

  @Field({ nullable: true })
  consultorio?: string;
}

@ObjectType()
export class MetricasIA {
  @Field(() => Float)
  precision_global: number;

  @Field(() => Float)
  precision_nivel_1: number;

  @Field(() => Float)
  precision_nivel_2: number;

  @Field(() => Float)
  precision_nivel_3: number;

  @Field(() => Float)
  precision_nivel_4: number;

  @Field(() => Float)
  precision_nivel_5: number;

  @Field(() => Int)
  escalamientos: number;

  @Field(() => Int)
  degradaciones: number;
}

@ObjectType()
export class DashboardJefeGuardia {
  @Field(() => [AlertaCritica])
  alertas_escaladas: AlertaCritica[];

  @Field(() => MetricasTiempoReal)
  metricas_tiempo_real: MetricasTiempoReal;

  @Field(() => DistribucionPorNivel)
  distribucion_niveles: DistribucionPorNivel;

  @Field(() => TiemposPromedio)
  tiempos_promedio: TiemposPromedio;

  @Field(() => [MiembroEquipo])
  enfermeros: MiembroEquipo[];

  @Field(() => [MiembroEquipo])
  medicos: MiembroEquipo[];

  @Field(() => MetricasIA)
  metricas_ia: MetricasIA;
}