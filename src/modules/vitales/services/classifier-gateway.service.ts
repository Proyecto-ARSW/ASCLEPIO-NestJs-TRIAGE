// src/modules/vitales/services/classifier-gateway.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ResultadoClasificador } from '../dto/vitales-response.dto';

@Injectable()
export class ClassifierGatewayService {
  private readonly logger = new Logger(ClassifierGatewayService.name);
  private readonly useApiGateway: boolean;
  private readonly classifierUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.useApiGateway = this.configService.get<boolean>('app.useApiGateway', false);

    if (this.useApiGateway) {
      // CON API Gateway
      const gatewayUrl = this.configService.get<string>('app.apiGatewayUrl');
      this.classifierUrl = `${gatewayUrl}/api/ia-classifier`;
      this.logger.log(`Usando API Gateway: ${this.classifierUrl}`);
    } else {
      // SIN API Gateway (desarrollo local)
      this.classifierUrl = this.configService.get<string>('app.triageClassifierUrl');
      this.logger.log(`Conexión directa a Classifier: ${this.classifierUrl}`);
    }
  }

  /**
   * Clasifica el paciente con Random Forest (MS 4)
   */
  async clasificarConVitales(data: {
    categoria: string;
    respuestas: any[];
    score_total: number;
    score_max: number;
    nivel_preliminar: number;

    presion_sistolica: number;
    presion_diastolica: number;
    frecuencia_cardiaca: number;
    frecuencia_respiratoria: number;
    temperatura: number;
    saturacion_oxigeno: number;

    edad: number;
    sexo: string;
  }): Promise<ResultadoClasificador> {
    try {
      this.logger.debug(
        `Llamando a Random Forest Classifier - Vitales registrados`,
      );

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.classifierUrl}/clasificar`,
          data,
          {
            timeout: 15000,
            headers: {
              'Content-Type': 'application/json',
              ...(this.useApiGateway && {
                'X-Internal-Request': 'true',
              }),
            },
          },
        ),
      );

      this.logger.debug(`Clasificación completada - Nivel: ${response.data.nivel_sugerido}`);

      return {
        nivel_sugerido: response.data.nivel_sugerido,
        confianza: response.data.confianza,
        probabilidades: response.data.probabilidades,
        features_clave: response.data.features_clave || [],
        alertas_vitales: response.data.alertas_vitales || [],
        razon_clinica: response.data.razon_clinica,
        modelo_version: response.data.modelo_version || 'rf_v2.1',
      };
    } catch (error) {
      this.logger.error(
        `Error al llamar a Classifier: ${error.message}`,
        error.stack,
      );

      return this.fallbackClasificacion(data);
    }
  }

  /**
   * Fallback cuando Random Forest no está disponible
   */
  private fallbackClasificacion(data: any): ResultadoClasificador {
    this.logger.warn('Usando clasificación de fallback (Classifier no disponible)');

    const nivelSugerido = data.nivel_preliminar || 3;

    const alertas: string[] = [];

    if (data.presion_sistolica < 90) alertas.push('HIPOTENSIÓN');
    if (data.saturacion_oxigeno < 90) alertas.push('HIPOXEMIA');
    if (data.frecuencia_cardiaca > 140) alertas.push('TAQUICARDIA');
    if (data.temperatura > 39.5) alertas.push('FIEBRE ALTA');

    let nivelFinal = nivelSugerido;
    if (alertas.length >= 2 && nivelSugerido > 2) {
      nivelFinal = 2; 
    }

    return {
      nivel_sugerido: nivelFinal,
      confianza: 0.6,
      probabilidades: {
        nivel_1: nivelFinal === 1 ? 0.6 : 0.1,
        nivel_2: nivelFinal === 2 ? 0.6 : 0.15,
        nivel_3: nivelFinal === 3 ? 0.6 : 0.3,
        nivel_4: nivelFinal === 4 ? 0.6 : 0.25,
        nivel_5: nivelFinal === 5 ? 0.6 : 0.2,
      },
      features_clave: ['FALLBACK - Nivel preliminar', ...alertas],
      alertas_vitales: alertas,
      razon_clinica: 'Evaluación automática por fallo en clasificador ML',
      modelo_version: 'fallback_v1.0',
    };
  }
}