// src/modules/dashboard/dto/dashboard-paciente.dto.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class TurnoInfoPaciente {
  @Field(() => Int)
  numero_turno: number;

  @Field()
  estado: string;

  @Field(() => Int)
  nivel_triage: number;

  @Field()
  nivel_nombre: string;

  @Field()
  nivel_color: string;

  @Field(() => Int)
  tiempo_espera_minutos: number;

  @Field(() => Int)
  posicion_en_cola: number;

  @Field(() => Int)
  total_en_cola: number;

  @Field({ nullable: true })
  consultorio_asignado?: string;

  @Field({ nullable: true })
  medico_asignado?: string;
}

@ObjectType()
export class PacientesDelantePorNivel {
  @Field(() => Int)
  nivel_1: number;

  @Field(() => Int)
  nivel_2: number;

  @Field(() => Int)
  nivel_3: number;
}

@ObjectType()
export class HistorialPasoTurno {
  @Field()
  paso: string;

  @Field()
  timestamp: Date;

  @Field()
  completado: boolean;
}

@ObjectType()
export class DashboardPaciente {
  @Field(() => TurnoInfoPaciente)
  turno: TurnoInfoPaciente;

  @Field(() => PacientesDelantePorNivel)
  pacientes_delante: PacientesDelantePorNivel;

  @Field(() => Int)
  tiempo_estimado_espera: number;

  @Field(() => [HistorialPasoTurno])
  historial: HistorialPasoTurno[];
}