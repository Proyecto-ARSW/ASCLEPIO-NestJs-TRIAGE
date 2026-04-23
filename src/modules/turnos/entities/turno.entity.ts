// src/modules/turnos/entities/turno.entity.ts

import { Field, ObjectType, Int, registerEnumType } from '@nestjs/graphql';
import { Paciente } from '@/modules/shared/entities/paciente.entity';
import { Hospital } from '@/modules/shared/entities/hospital.entity';
import { NivelTriage } from '@/modules/shared/entities/nivel-triage.entity';

export enum TipoTurno {
  CONSULTA = 'CONSULTA',
  URGENCIA = 'URGENCIA',
}

export enum EstadoTurno {
  CLASIFICACION_PENDIENTE = 'CLASIFICACION_PENDIENTE',
  ESPERANDO_CONFIRMACION = 'ESPERANDO_CONFIRMACION',
  EN_ESPERA = 'EN_ESPERA',
  EN_CONSULTA = 'EN_CONSULTA',
  ATENDIDO = 'ATENDIDO',
  CANCELADO = 'CANCELADO',
}

registerEnumType(TipoTurno, { name: 'TipoTurno' });
registerEnumType(EstadoTurno, { name: 'EstadoTurno' });

@ObjectType()
export class Turno {
  @Field()
  id: string;

  @Field(() => Int)
  hospital_id: number;

  @Field()
  paciente_id: string;

  @Field(() => TipoTurno)
  tipo_turno: TipoTurno;

  @Field({ nullable: true })
  medico_id?: string;

  @Field(() => Int, { nullable: true })
  especialidad_id?: number;

  @Field({ nullable: true })
  fecha_hora_programada?: Date;

  @Field({ nullable: true })
  registro_triage_id?: string;

  @Field({ nullable: true })
  enfermero_triage_id?: string;

  @Field(() => Int, { nullable: true })
  nivel_triage_id?: number;

  @Field(() => Int)
  numero_turno: number;

  @Field(() => EstadoTurno)
  estado: EstadoTurno;

  @Field({ nullable: true })
  llamado_en?: Date;

  @Field({ nullable: true })
  atendido_en?: Date;

  @Field({ nullable: true })
  finalizado_en?: Date;

  @Field()
  fecha: Date;

  @Field()
  creado_en: Date;

  @Field()
  actualizado_en: Date;

  @Field(() => Hospital, { nullable: true })
  hospital?: Hospital;

  @Field(() => Paciente, { nullable: true })
  paciente?: Paciente;

  @Field(() => NivelTriage, { nullable: true })
  nivel_triage?: NivelTriage;
  
  @Field(() => Int, { nullable: true })
  get tiempo_espera_minutos(): number | null {
    if (!this.llamado_en) return null;
    const diff = this.llamado_en.getTime() - this.creado_en.getTime();
    return Math.floor(diff / 60000);
  }

  @Field(() => Int, { nullable: true })
  get tiempo_atencion_minutos(): number | null {
    if (!this.finalizado_en || !this.atendido_en) return null;
    const diff = this.finalizado_en.getTime() - this.atendido_en.getTime();
    return Math.floor(diff / 60000);
  }
}