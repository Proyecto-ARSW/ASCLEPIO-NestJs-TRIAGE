// src/modules/vitales/entities/registro-triage.entity.ts

import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { Paciente } from '@/modules/shared/entities/paciente.entity';
import { Hospital } from '@/modules/shared/entities/hospital.entity';
import { Enfermero } from '@/modules/shared/entities/enfermero.entity';
import { NivelTriage } from '@/modules/shared/entities/nivel-triage.entity';
import { CuestionarioTriage } from '@/modules/cuestionario/entities/cuestionario-triage.entity';

export enum TipoEvaluacion {
  PRELIMINAR = 'PRELIMINAR',
  FINAL = 'FINAL',
}

@ObjectType()
export class RegistroTriage {
  @Field()
  id: string;

  @Field()
  paciente_id: string;

  @Field(() => Int)
  hospital_id: number;

  @Field()
  enfermero_id: string;

  @Field({ nullable: true })
  cuestionario_id?: string;

  // Nivel de triage
  @Field(() => Int, { nullable: true })
  nivel_triage_id?: number;

  @Field(() => Int, { nullable: true })
  nivel_sugerido_ia?: number;

  @Field(() => Float, { nullable: true })
  confianza_ia?: number;

  // Datos clínicos
  @Field()
  motivo_consulta: string;

  @Field({ nullable: true })
  sintomas?: string;

  @Field(() => Int, { nullable: true })
  presion_sistolica?: number;

  @Field(() => Int, { nullable: true })
  presion_diastolica?: number;

  @Field(() => Int, { nullable: true })
  frecuencia_cardiaca?: number;

  @Field(() => Int, { nullable: true })
  frecuencia_respiratoria?: number;

  @Field(() => Float, { nullable: true })
  temperatura?: number;

  @Field(() => Int, { nullable: true })
  saturacion_oxigeno?: number;

  // Control
  @Field({ nullable: true })
  observaciones?: string;

  @Field()
  tipo_evaluacion: TipoEvaluacion;

  @Field(() => Int, { nullable: true })
  tiempo_registro_ms?: number;

  @Field()
  es_reclasificacion: boolean;

  @Field({ nullable: true })
  triage_original_id?: string;

  @Field()
  creado_en: Date;

  // Relaciones
  @Field(() => Paciente, { nullable: true })
  paciente?: Paciente;

  @Field(() => Hospital, { nullable: true })
  hospital?: Hospital;

  @Field(() => Enfermero, { nullable: true })
  enfermero?: Enfermero;

  @Field(() => CuestionarioTriage, { nullable: true })
  cuestionario?: CuestionarioTriage;

  @Field(() => NivelTriage, { nullable: true })
  nivel_triage?: NivelTriage;

  @Field(() => NivelTriage, { nullable: true })
  nivel_sugerido?: NivelTriage;

  // Computed fields
  @Field(() => Float, { nullable: true })
  get presion_arterial_media(): number | null {
    if (!this.presion_sistolica || !this.presion_diastolica) return null;
    return (this.presion_sistolica + 2 * this.presion_diastolica) / 3;
  }

  @Field(() => Float, { nullable: true })
  get shock_index(): number | null {
    if (!this.frecuencia_cardiaca || !this.presion_sistolica) return null;
    return this.frecuencia_cardiaca / this.presion_sistolica;
  }

  @Field()
  get tiene_alertas_vitales(): boolean {
    return this.detectarAlertasVitales().length > 0;
  }

  detectarAlertasVitales(): string[] {
    const alertas: string[] = [];

    if (this.presion_sistolica && (this.presion_sistolica < 90 || this.presion_sistolica > 180)) {
      alertas.push('PRESIÓN ARTERIAL CRÍTICA');
    }

    if (this.frecuencia_cardiaca && (this.frecuencia_cardiaca < 40 || this.frecuencia_cardiaca > 140)) {
      alertas.push('FRECUENCIA CARDÍACA ANORMAL');
    }

    if (this.saturacion_oxigeno && this.saturacion_oxigeno < 90) {
      alertas.push('HIPOXEMIA SEVERA');
    }

    if (this.temperatura && this.temperatura > 39.5) {
      alertas.push('FIEBRE ALTA');
    }

    if (this.temperatura && this.temperatura < 35) {
      alertas.push('HIPOTERMIA');
    }

    if (this.frecuencia_respiratoria && (this.frecuencia_respiratoria < 8 || this.frecuencia_respiratoria > 30)) {
      alertas.push('FRECUENCIA RESPIRATORIA ANORMAL');
    }

    return alertas;
  }
}