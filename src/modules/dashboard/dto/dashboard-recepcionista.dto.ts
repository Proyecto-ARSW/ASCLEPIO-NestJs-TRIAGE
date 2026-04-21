// src/modules/dashboard/dto/dashboard-recepcionista.dto.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class ResumenDiaRecepcionista {
  @Field(() => Int)
  turnos_creados: number;

  @Field(() => Int)
  en_espera: number;

  @Field(() => Int)
  atendidos: number;

  @Field(() => Int)
  cancelados: number;

  @Field(() => Int)
  tiempo_promedio_espera: number;
}

@ObjectType()
export class TurnoActivoRecepcionista {
  @Field(() => Int)
  numero_turno: number;

  @Field()
  paciente_nombre: string;

  @Field()
  estado: string;

  @Field(() => Int)
  nivel_triage: number;

  @Field(() => Int)
  tiempo_espera_minutos: number;

  @Field({ nullable: true })
  consultorio?: string;
}

@ObjectType()
export class AlertaRecepcionista {
  @Field()
  turno_id: string;

  @Field(() => Int)
  numero_turno: number;

  @Field()
  tipo: string;

  @Field()
  mensaje: string;

  @Field()
  timestamp: Date;
}

@ObjectType()
export class DashboardRecepcionista {
  @Field(() => ResumenDiaRecepcionista)
  resumen: ResumenDiaRecepcionista;

  @Field(() => [AlertaRecepcionista])
  alertas_activas: AlertaRecepcionista[];

  @Field(() => [TurnoActivoRecepcionista])
  turnos_activos: TurnoActivoRecepcionista[];

  @Field(() => Int)
  total_turnos_activos: number;
}