import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { Paciente } from './paciente.entity';
import { Hospital } from './hospital.entity';
import { Enfermero } from './enfermero.entity';
import { NivelTriage } from './nivel-triage.entity';
 
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
 
  // Datos del paciente (de ISISvoice)
  @Field(() => [String])
  sintomas: string[];
 
  @Field()
  embarazo: boolean;
 
  @Field(() => [String])
  antecedentes: string[];
 
  @Field(() => Int)
  nivel_preliminar_isisvoice: number;
 
  @Field({ nullable: true })
  comentario_paciente?: string;
 
  // Signos vitales
  @Field(() => Int)
  presion_sistolica: number;
 
  @Field(() => Int)
  presion_diastolica: number;
 
  @Field(() => Int)
  frecuencia_cardiaca: number;
 
  @Field(() => Int)
  frecuencia_respiratoria: number;
 
  @Field(() => Float)
  temperatura: number;
 
  @Field(() => Int)
  saturacion_oxigeno: number;
 
  // Clasificación IA
  @Field(() => Int, { nullable: true })
  nivel_triage_id?: number;
 
  @Field(() => Int)
  nivel_sugerido_ia: number;
 
  @Field(() => Float)
  confianza_ia: number;
 
  @Field({ nullable: true })
  comentarios_ia?: string;
 
  // Observaciones
  @Field()
  motivo_consulta: string;
 
  @Field({ nullable: true })
  observaciones?: string;
 
  @Field()
  tiene_alertas_vitales: boolean;
 
  @Field()
  creado_en: Date;
 
  // Relaciones
  @Field(() => Paciente, { nullable: true })
  paciente?: Paciente;
 
  @Field(() => Hospital, { nullable: true })
  hospital?: Hospital;
 
  @Field(() => Enfermero, { nullable: true })
  enfermero?: Enfermero;
 
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
}