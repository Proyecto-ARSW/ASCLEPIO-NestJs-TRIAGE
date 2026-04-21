// src/modules/alertas/entities/alerta-triage.entity.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';
import { Turno } from '@/modules/turnos/entities/turno.entity';

@ObjectType()
export class AlertaTriage {
  @Field()
  id: string;

  @Field()
  turno_id: string;

  @Field(() => Int)
  hospital_id: number;

  @Field(() => Int)
  nivel_triage: number;

  @Field(() => Int)
  tiempo_espera_minutos: number;

  @Field(() => Int)
  tiempo_max_espera_minutos: number;

  @Field({ nullable: true })
  mensaje?: string;

  @Field()
  resuelta: boolean;

  @Field({ nullable: true })
  resuelta_en?: Date;

  @Field()
  creado_en: Date;

  @Field(() => Turno, { nullable: true })
  turno?: Turno;


  @Field(() => Int)
  get tiempo_excedido_minutos(): number {
    return this.tiempo_espera_minutos - this.tiempo_max_espera_minutos;
  }

  @Field()
  get criticidad(): string {
    const exceso = this.tiempo_excedido_minutos;
    
    if (exceso >= 60) return 'CRÍTICO';
    if (exceso >= 30) return 'ALTO';
    if (exceso >= 10) return 'MEDIO';
    return 'BAJO';
  }
}