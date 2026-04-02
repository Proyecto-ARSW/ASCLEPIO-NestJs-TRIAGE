// src/modules/alertas/entities/alerta-critica.entity.ts

import { Field, ObjectType, Int, registerEnumType } from '@nestjs/graphql';
import { Turno } from '@/modules/turnos/entities/turno.entity';
import { NivelTriage } from '@/modules/shared/entities/nivel-triage.entity';

export enum TipoAlerta {
  TRIAGE_CRITICO = 'TRIAGE_CRITICO',                     
  TRIAGE_ESCALADO = 'TRIAGE_ESCALADO',                  
  TRIAGE_CRITICO_PRELIMINAR = 'TRIAGE_CRITICO_PRELIMINAR',
}

registerEnumType(TipoAlerta, { name: 'TipoAlerta' });

@ObjectType()
export class AlertaCritica {
  @Field()
  id: string;

  @Field()
  turno_id: string;

  @Field(() => Int)
  hospital_id: number;

  @Field(() => Int)
  nivel_triage: number;

  @Field(() => TipoAlerta)
  tipo_alerta: TipoAlerta;

  @Field({ nullable: true })
  medico_asignado_id?: string;

  @Field()
  confirmada: boolean;

  @Field({ nullable: true })
  confirmada_en?: Date;

  @Field({ nullable: true })
  confirmada_por?: string;

  @Field()
  escalada: boolean;

  @Field({ nullable: true })
  escalada_en?: Date;

  @Field({ nullable: true })
  escalada_a?: string;

  @Field({ nullable: true })
  razon_escalamiento?: string;

  @Field()
  activa: boolean;

  @Field()
  creado_en: Date;

  @Field()
  actualizado_en: Date;

  @Field(() => Turno, { nullable: true })
  turno?: Turno;

  @Field(() => NivelTriage, { nullable: true })
  nivel?: NivelTriage;

  @Field(() => Int, { nullable: true })
  get tiempo_sin_confirmar_min(): number | null {
    if (this.confirmada) return null;
    
    const ahora = new Date();
    const diff = ahora.getTime() - this.creado_en.getTime();
    return Math.floor(diff / 60000);
  }

  @Field()
  get requiere_atencion_inmediata(): boolean {
    return !this.confirmada && this.nivel_triage === 1;
  }

  @Field()
  get timeout_excedido(): boolean {
    const tiempoSinConfirmar = this.tiempo_sin_confirmar_min;
    return tiempoSinConfirmar !== null && tiempoSinConfirmar > 3;
  }
}