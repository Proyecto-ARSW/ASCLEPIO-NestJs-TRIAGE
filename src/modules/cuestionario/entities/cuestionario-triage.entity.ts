// src/modules/cuestionario/entities/cuestionario-triage.entity.ts

import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { Paciente } from '@/modules/shared/entities/paciente.entity';
import { Hospital } from '@/modules/shared/entities/hospital.entity';
import { NivelTriage } from '@/modules/shared/entities/nivel-triage.entity';
import { Turno } from '@/modules/turnos/entities/turno.entity';

@ObjectType()
export class RespuestaCuestionario {
  @Field(() => Int)
  pregunta_id: number;

  @Field()
  pregunta: string;

  @Field(() => Int)
  valor: number;

  @Field()
  texto: string;
}

@ObjectType()
export class CuestionarioTriage {
  @Field()
  id: string;

  @Field()
  paciente_id: string;

  @Field(() => Int)
  hospital_id: number;

  @Field()
  turno_id: string;

  @Field()
  categoria_molestia: string;

  @Field(() => [RespuestaCuestionario])
  respuestas: RespuestaCuestionario[];

  @Field(() => Int)
  score_total: number;

  @Field(() => Int)
  score_max: number;

  @Field({ nullable: true })
  motivo_texto_libre?: string;

  @Field(() => Int, { nullable: true })
  nivel_sugerido_ia_preliminar?: number;

  @Field(() => Float, { nullable: true })
  confianza_ia_preliminar?: number;

  @Field(() => [String], { nullable: true })
  sintomas_detectados_ia?: string[];

  @Field({ nullable: true })
  razon_clinica_ia?: string;

  @Field(() => Int, { nullable: true })
  tiempo_llenado_ms?: number;

  @Field()
  requirio_ollama: boolean;

  @Field()
  creado_en: Date;

  @Field(() => Paciente, { nullable: true })
  paciente?: Paciente;

  @Field(() => Hospital, { nullable: true })
  hospital?: Hospital;

  @Field(() => Turno, { nullable: true })
  turno?: Turno;

  @Field(() => NivelTriage, { nullable: true })
  nivel_preliminar?: NivelTriage;
}