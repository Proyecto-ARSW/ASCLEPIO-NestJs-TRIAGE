// src/modules/vitales/services/classifier-gateway.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ResultadoClasificadorDto } from '../dto/resultado-clasificador.dto';

@Injectable()
export class ClassifierGatewayService {
  private readonly logger = new Logger(ClassifierGatewayService.name);
  private readonly classifierUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.classifierUrl = this.configService.get<string>('CLASSIFIER_SERVICE_URL') || 'http://localhost:3003';
  }

  /**
   * Llama al Random Forest para clasificar el nivel de triage
   */
  async clasificar(payload: any): Promise<ResultadoClasificadorDto> {
    const url = `${this.classifierUrl}/api/clasificar`;

    try {
      this.logger.log(`Llamando a Random Forest: ${url}`);

      const response = await this.httpService.axiosRef.post(url, payload, {
        timeout: 5000, // 5 segundos
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.logger.log(`Random Forest respondió: nivel ${response.data.nivel_sugerido}`);

      return response.data;
    } catch (error) {
      this.logger.error(`Error al llamar al clasificador: ${error.message}`);
      throw error;
    }
  }
}