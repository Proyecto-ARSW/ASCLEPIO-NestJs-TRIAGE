// src/modules/vitales/dto/resultado-clasificador.dto.ts

export class ResultadoClasificadorDto {
  nivel_sugerido: number;
  confianza: number;
  comentarios: string;
  probabilidades: {
    nivel_1: number;
    nivel_2: number;
    nivel_3: number;
    nivel_4: number;
    nivel_5: number;
  };
  feature_mas_importante?: string;
  valor_feature_importante?: number;
}