import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClassifierGatewayService {
  private readonly logger = new Logger(ClassifierGatewayService.name);
  private readonly classifierUrl: string;
  private readonly classifierApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.classifierUrl =
      this.configService.get<string>('CLASSIFIER_SERVICE_URL') ||
      'http://172.168.108.215:8000';
    this.classifierApiKey = this.configService.get<string>('CLASSIFIER_API_KEY');
  }

  async clasificar(payload: any): Promise<any> {
    const url = `${this.classifierUrl}/api/v1/predict/triage`;
    this.logger.log(`Llamando a Mike (Random Forest): ${url}`);
    const mikePayload = {
      triage_data: {
        sintomas: payload.sintomas ?? [],
        embarazo: payload.embarazo ?? false,
        antecedentes: payload.antecedentes ?? [],
        vital_signs: {
          temperature_c: payload.temperatura,
          heart_rate_bpm: payload.frecuencia_cardiaca,
          respiratory_rate_bpm: payload.frecuencia_respiratoria,
          oxygen_saturation_pct: payload.saturacion_oxigeno,
          systolic_bp_mmhg: payload.presion_sistolica,
          diastolic_bp_mmhg: payload.presion_diastolica,
          weight_kg: payload.peso_kg ?? null,
          height_cm: payload.altura_cm ?? null,
        },
      },
    };

    const response = await this.httpService.axiosRef.post(url, mikePayload, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.classifierApiKey && { 'x-api-key': this.classifierApiKey }), // ← NUEVO
      },
    });

    const data = response.data;

    this.logger.log(
      `Mike respondió: nivel ${data.nivel_sugerido ?? data.nivel_triage}, confianza ${data.confianza}`,
    );

    return {
      nivel_sugerido: data.nivel_sugerido ?? data.nivel_triage,
      confianza: data.confianza,
      comentarios: data.comentarios ?? data.descripcion_triage ?? null,
      probabilidades: data.probabilidades ?? {
        nivel_1: 0,
        nivel_2: 0,
        nivel_3: 0,
        nivel_4: 0,
        nivel_5: 0,
      },
      feature_mas_importante: data.feature_mas_importante ?? null,
      valor_feature_importante: data.valor_feature_importante ?? null,
    };
  }
}