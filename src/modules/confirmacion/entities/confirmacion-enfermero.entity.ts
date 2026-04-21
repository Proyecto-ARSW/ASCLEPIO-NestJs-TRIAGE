// src/modules/confirmacion/entities/confirmacion-enfermero.entity.ts

import { Field, ObjectType, Int } from '@nestjs/graphql';
import { Enfermero } from '@/modules/shared/entities/enfermero.entity';
import { NivelTriage } from '@/modules/shared/entities/nivel-triage.entity';
import { RegistroTriage } from '@/modules/vitales/entities/registro-triage.entity';

@ObjectType()
export class ConfirmacionEnfermero {
  @Field()
  id: string;

  @Field()
  registro_triage_id: string;

  @Field()
  enfermero_id: string;

  @Field(() => Int, { nullable: true })
  nivel_sugerido_ia_preliminar?: number;

  @Field(() => Int)
  nivel_sugerido_ollama: number;

  @Field(() => Int)
  nivel_final_enfermero: number;

  @Field()
  acepto_sugerencia: boolean;

  @Field({ nullable: true })
  razon_modificacion?: string;

  @Field(() => Int, { nullable: true })
  tiempo_evaluacion_ms?: number;

  @Field()
  creado_en: Date;

  @Field(() => RegistroTriage, { nullable: true })
  registro_triage?: RegistroTriage;

  @Field(() => Enfermero, { nullable: true })
  enfermero?: Enfermero;

  @Field(() => NivelTriage, { nullable: true })
  nivel_preliminar?: NivelTriage;

  @Field(() => NivelTriage, { nullable: true })
  nivel_ollama?: NivelTriage;

  @Field(() => NivelTriage, { nullable: true })
  nivel_final?: NivelTriage;

  @Field(() => Int)
  get diferencia_niveles(): number {
    return Math.abs(this.nivel_sugerido_ollama - this.nivel_final_enfermero);
  }

  @Field()
  get fue_escalamiento(): boolean {
    return this.nivel_final_enfermero < this.nivel_sugerido_ollama;
  }

  @Field()
  get fue_degradacion(): boolean {
    return this.nivel_final_enfermero > this.nivel_sugerido_ollama;
  }
}