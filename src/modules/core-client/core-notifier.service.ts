// src/modules/core-client/core-notifier.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CoreNotifierService {
  private readonly logger = new Logger(CoreNotifierService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get coreUrl(): string {
    return this.configService.get<string>('CORE_API_URL', 'http://localhost:3000');
  }

  private get apiKey(): string {
    return this.configService.get<string>('CORE_API_KEY', '');
  }

  /**
   * Notifica a Core que se creó un turno de urgencia.
   * Core puede actualizar el estado del paciente en su DB.
   */
  async notificarTurnoCreado(payload: {
    turno_id: string;
    numero_turno: number;
    hospital_id: number;
    paciente_id: string;
    tipo_turno: string;
    estado: string;
    fecha: string;
  }): Promise<void> {
    await this.enviarWebhook('/webhooks/triage/turno-creado', payload);
  }

  /**
   * Notifica a Core que se canceló un turno.
   * Core puede revertir el estado del paciente.
   */
  async notificarTurnoCancelado(payload: {
    turno_id: string;
    hospital_id: number;
    paciente_id: string;
    numero_turno: number;
    razon: string;
  }): Promise<void> {
    await this.enviarWebhook('/webhooks/triage/turno-cancelado', payload);
  }

  /**
   * Notifica a Core que un paciente fue atendido.
   * Core puede crear un registro en historial y actualizar estado.
   */
  async notificarPacienteAtendido(payload: {
    turno_id: string;
    numero_turno: number;
    hospital_id: number;
    paciente_id: string;
    medico_id: string;
    nivel_triage: number;
    tiempo_espera_minutos: number;
    tiempo_atencion_minutos: number;
    diagnostico: string;
    tratamiento: string;
    observaciones?: string;
  }): Promise<void> {
    await this.enviarWebhook('/webhooks/triage/paciente-atendido', payload);
  }

  /**
   * Envía un webhook a Core con reintentos.
   */
  private async enviarWebhook(path: string, payload: any): Promise<void> {
    const url = `${this.coreUrl}${path}`;
    const maxRetries = 3;

    for (let intento = 1; intento <= maxRetries; intento++) {
      try {
        await firstValueFrom(
          this.httpService.post(url, payload, {
            headers: {
              'x-api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }),
        );

        this.logger.log(`Webhook enviado a Core: ${path}`);
        return;
      } catch (error: any) {
        const status = error?.response?.status;
        this.logger.error(
          `Error enviando webhook ${path} (intento ${intento}/${maxRetries}): ${status || error?.message}`,
        );

        if (intento < maxRetries) {
          const delay = intento * 2000; 
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(`Webhook fallido después de ${maxRetries} intentos: ${path}`);
  }
}
