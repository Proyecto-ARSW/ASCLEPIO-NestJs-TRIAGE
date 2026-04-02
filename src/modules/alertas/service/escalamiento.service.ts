// src/modules/alertas/services/escalamiento.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertaCriticaService } from './alerta-critica.service';
import { EscalarAlertaDto } from '../dto/escalar-alerta.dto';
import { AlertaCritica, TipoAlerta } from '../entities/alerta-critica.entity';
import { RedisService } from '@/modules/cola/services/redis.service';
import { TriageEventPublisher } from '@/modules/eventos/publishers/triage-event.publisher';

@Injectable()
export class EscalamientoService {
  private readonly logger = new Logger(EscalamientoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertaCriticaService: AlertaCriticaService,
    private readonly redis: RedisService,
    private readonly eventPublisher: TriageEventPublisher,
  ) {}

  /**
   * Escala una alerta al jefe de guardia
   */
  async escalarAlerta(dto: EscalarAlertaDto): Promise<AlertaCritica> {
    this.logger.warn(
      `Escalando alerta ${dto.alerta_id} a jefe de guardia ${dto.jefe_guardia_id}`,
    );

    const alerta = await this.alertaCriticaService.obtenerPorId(dto.alerta_id);

    if (alerta.escalada) {
      this.logger.warn(`Alerta ${dto.alerta_id} ya fue escalada`);
      return alerta;
    }

    const alertaEscalada = await this.prisma.alertas_criticas.update({
      where: { id: dto.alerta_id },
      data: {
        escalada: true,
        escalada_en: new Date(),
        escalada_a: dto.jefe_guardia_id,
        razon_escalamiento: dto.razon_escalamiento,
        tipo_alerta: TipoAlerta.TRIAGE_ESCALADO,
      },
      include: {
        turnos: {
          include: {
            pacientes: {
              include: {
                usuarios: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Alerta escalada a jefe de guardia`);

    await this.eventPublisher.publishAlertaEscalada({
      alerta_id: alertaEscalada.id,
      turno_id: alertaEscalada.turno_id,
      hospital_id: alertaEscalada.hospital_id,
      jefe_guardia_id: dto.jefe_guardia_id,
      razon_escalamiento: dto.razon_escalamiento,
      tiempo_sin_confirmar_min: alerta.tiempo_sin_confirmar_min,
    });

    return alertaEscalada as AlertaCritica;
  }

  /**
   * Proceso automático de escalamiento (ejecutado por cron)
   * Escala alertas que no han sido confirmadas en 3 minutos
   */
  async procesarEscalamientoAutomatico(): Promise<number> {
    this.logger.log('Ejecutando proceso de escalamiento automático...');

    const alertasPendientes =
      await this.alertaCriticaService.obtenerAlertasPendientesEscalamiento();

    if (alertasPendientes.length === 0) {
      this.logger.debug('✅ No hay alertas pendientes de escalamiento');
      return 0;
    }

    this.logger.warn(
      `${alertasPendientes.length} alerta(s) requieren escalamiento automático`,
    );

    let escaladas = 0;

    for (const alerta of alertasPendientes) {
      try {
        const jefeGuardia = await this.obtenerJefeGuardia(alerta.hospital_id);

        if (!jefeGuardia) {
          this.logger.error(
            `No se encontró jefe de guardia para hospital ${alerta.hospital_id}`,
          );
          continue;
        }

        await this.escalarAlerta({
          alerta_id: alerta.id,
          jefe_guardia_id: jefeGuardia.id,
          razon_escalamiento: `Escalamiento automático por timeout (${alerta.tiempo_sin_confirmar_min} minutos sin confirmar)`,
        });

        escaladas++;
      } catch (error) {
        this.logger.error(
          `Error al escalar alerta ${alerta.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Proceso completado - ${escaladas} alerta(s) escalada(s)`);

    return escaladas;
  }

  /**
   * Obtiene el jefe de guardia de un hospital
   */
  private async obtenerJefeGuardia(hospitalId: number): Promise<any | null> {
    const jefeGuardia = await this.prisma.usuarios.findFirst({
      where: {
        rol: 'JEFE_GUARDIA',
        activo: true,
        hospital_usuario: {
          some: {
            hospital_id: hospitalId,
          },
        },
      },
    });

    return jefeGuardia;
  }

  /**
   * Publica alerta escalada en Redis
   */
  private async publicarAlertaEscalada(alerta: any): Promise<void> {
    const channel = `hospital:${alerta.hospital_id}:alerta:escalada`;
    const mensaje = JSON.stringify({
      alerta_id: alerta.id,
      turno_id: alerta.turno_id,
      escalada_a: alerta.escalada_a,
      razon: alerta.razon_escalamiento,
      timestamp: new Date().toISOString(),
    });

    await this.redis.publish(channel, mensaje);
  }
}