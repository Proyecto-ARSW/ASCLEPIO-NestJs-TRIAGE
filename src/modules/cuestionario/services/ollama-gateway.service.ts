// src/modules/cuestionario/services/ollama-gateway.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RespuestaDto } from '../dto/respuesta.dto';

export interface ResultadoOllama {
  nivel_sugerido: number;
  sintomas_detectados: string[];
  razon_clinica: string;
  confianza: number;
  requirio_ollama: boolean;
}

@Injectable()
export class OllamaGatewayService {
  private readonly logger = new Logger(OllamaGatewayService.name);
  private readonly useApiGateway: boolean;
  private readonly ollamaUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.useApiGateway = this.configService.get<boolean>('app.useApiGateway', false);

    if (this.useApiGateway) {
      const gatewayUrl = this.configService.get<string>('app.apiGatewayUrl');
      this.ollamaUrl = `${gatewayUrl}/api/ia-prelim`;
      this.logger.log(`Usando API Gateway: ${this.ollamaUrl}`);
    } else {
      this.ollamaUrl = this.configService.get<string>('app.ollamaPrelimUrl');
      this.logger.log(`Conexión directa a Ollama: ${this.ollamaUrl}`);
    }
  }

  /**
   * Evalúa el cuestionario con Ollama (MS 3)
   */
  async evaluarPreliminar(data: {
    categoria: string;
    respuestas: RespuestaDto[];
    score_total: number;
    score_max: number;
    motivo_texto_libre?: string;
  }): Promise<ResultadoOllama> {
    try {
      this.logger.debug(
        `Llamando a Ollama - Categoría: ${data.categoria}, Score: ${data.score_total}`,
      );

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.ollamaUrl}/evaluar-preliminar`,
          {
            categoria: data.categoria,
            respuestas: data.respuestas,
            score_total: data.score_total,
            score_max: data.score_max,
            motivo_texto_libre: data.motivo_texto_libre,
          },
          {
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              ...(this.useApiGateway && {
                'X-Internal-Request': 'true',
              }),
            },
          },
        ),
      );

      this.logger.debug(`Respuesta de Ollama recibida`);

      return {
        nivel_sugerido: response.data.nivel_sugerido,
        sintomas_detectados: response.data.sintomas_detectados,
        razon_clinica: response.data.razon_clinica,
        confianza: response.data.confianza,
        requirio_ollama: response.data.requirio_ollama,
      };
    } catch (error) {
      this.logger.error(
        `Error al llamar a Ollama: ${error.message}`,
        error.stack,
      );

      return this.fallbackEvaluacion(data);
    }
  }

  /**
   * Fallback cuando Ollama no está disponible
   */
  private fallbackEvaluacion(data: {
    score_total: number;
    score_max: number;
    respuestas: RespuestaDto[];
  }): ResultadoOllama {
    this.logger.warn('Usando evaluación de fallback (Ollama no disponible)');

    let nivelSugerido = 3;

    if (data.score_total < 10 && data.score_max <= 2) {
      nivelSugerido = 5;
    } else if (data.score_total < 15 && data.score_max <= 3) {
      nivelSugerido = 4;
    } else if (data.score_max >= 5) {
      nivelSugerido = 2; 
    }

    return {
      nivel_sugerido: nivelSugerido,
      sintomas_detectados: this.extraerSintomasSimples(data.respuestas),
      razon_clinica: 'Evaluación automática por fallo en sistema de IA',
      confianza: 0.5,
      requirio_ollama: false,
    };
  }

  /**
   * Extrae síntomas simples de las respuestas
   */
  private extraerSintomasSimples(respuestas: RespuestaDto[]): string[] {
    return respuestas
      .filter(r => r.valor >= 3)
      .map(r => r.texto)
      .slice(0, 5);
  }
}