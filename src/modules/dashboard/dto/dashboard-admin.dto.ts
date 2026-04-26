// src/modules/dashboard/dto/dashboard-admin.dto.ts

import { Field, ObjectType, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class KPIPrincipal {
  @Field(() => Int)
  atendidos: number;

  @Field(() => Float)
  cambio_porcentaje: number;

  @Field(() => Int)
  en_sistema: number;

  @Field(() => Float)
  cambio_sistema_porcentaje: number;

  @Field(() => Int)
  tiempo_promedio: number;

  @Field(() => Int)
  cambio_tiempo_minutos: number;

  @Field(() => Float)
  satisfaccion: number;

  @Field(() => Float)
  cambio_satisfaccion: number;
}

@ObjectType()
export class PuntoTendencia {
  @Field()
  fecha: string;

  @Field(() => Int)
  valor: number;
}

@ObjectType()
export class DistribucionSemanal {
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
export class MatrizConfusion {
  @Field(() => [[Int]])
  matriz: number[][];

  @Field(() => [String])
  etiquetas: string[];
}

@ObjectType()
export class FactorAjuste {
  @Field()
  factor: string;

  @Field(() => Int)
  frecuencia: number;

  @Field()
  tipo: string;
}

@ObjectType()
export class RendimientoIA {
  @Field(() => Float)
  precision_ollama: number;

  @Field(() => Float)
  precision_random_forest: number;

  @Field(() => MatrizConfusion)
  matriz_confusion: MatrizConfusion;

  @Field(() => [FactorAjuste])
  factores_ajuste: FactorAjuste[];
}

@ObjectType()
export class TiempoPorNivel {
  @Field(() => Int)
  nivel: number;

  @Field(() => Int)
  espera: number;

  @Field(() => Int)
  atencion: number;

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  objetivo: number;

  @Field()
  cumple_objetivo: boolean;
}

@ObjectType()
export class CuelloBotella {
  @Field()
  etapa: string;

  @Field(() => Int)
  tiempo_actual: number;

  @Field(() => Int)
  tiempo_objetivo: number;

  @Field()
  recomendacion: string;
}

@ObjectType()
export class AnalisisTiempos {
  @Field(() => [TiempoPorNivel])
  tiempos_por_nivel: TiempoPorNivel[];

  @Field(() => [CuelloBotella])
  cuellos_botella: CuelloBotella[];
}

@ObjectType()
export class ProductividadMedico {
  @Field()
  medico_id: string;

  @Field()
  nombre: string;

  @Field(() => Float)
  pacientes_por_hora: number;

  @Field(() => Int)
  total_atendidos: number;
}

@ObjectType()
export class PrecisionEnfermero {
  @Field()
  enfermero_id: string;

  @Field()
  nombre: string;

  @Field(() => Float)
  precision: number;

  @Field(() => Int)
  evaluaciones_realizadas: number;
}

@ObjectType()
export class AnalisisPersonal {
  @Field(() => [ProductividadMedico])
  productividad_medicos: ProductividadMedico[];

  @Field(() => [PrecisionEnfermero])
  precision_enfermeros: PrecisionEnfermero[];
}

@ObjectType()
export class DashboardAdmin {
  @Field(() => KPIPrincipal)
  kpis: KPIPrincipal;

  @Field(() => [PuntoTendencia])
  tendencia_atendidos: PuntoTendencia[];

  @Field(() => DistribucionSemanal)
  distribucion_semanal: DistribucionSemanal;

  @Field(() => RendimientoIA)
  rendimiento_ia: RendimientoIA;

  @Field(() => AnalisisTiempos)
  analisis_tiempos: AnalisisTiempos;

  @Field(() => AnalisisPersonal)
  analisis_personal: AnalisisPersonal;
}