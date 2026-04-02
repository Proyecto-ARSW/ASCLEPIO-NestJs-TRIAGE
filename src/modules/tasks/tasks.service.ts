// src/modules/tasks/tasks.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EscalamientoService } from '../alertas/services/escalamiento.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly escalamientoService: EscalamientoService) {}

  /**
   * Cron job: Ejecuta cada minuto
   * Escala alertas no confirmadas en 3 minutos
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async procesarEscalamientoAutomatico() {
    this.logger.debug('Cron: Verificando alertas para escalamiento...');

    try {
      const escaladas = await this.escalamientoService.procesarEscalamientoAutomatico();

      if (escaladas > 0) {
        this.logger.warn(`Cron: ${escaladas} alerta(s) escalada(s) automáticamente`);
      }
    } catch (error) {
      this.logger.error(`Cron: Error en escalamiento automático: ${error.message}`);
    }
  }

  /**
   * Cron job: Ejecuta cada 5 minutos
   * Verifica tiempos de espera excedidos
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async verificarTiemposEspera() {
    this.logger.debug('Cron: Verificando tiempos de espera...');
    
    // TODO: Implementar verificación de tiempos de espera
    // await this.alertaTriageService.verificarTiemposEspera();
  }
}