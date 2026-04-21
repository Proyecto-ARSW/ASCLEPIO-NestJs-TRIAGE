// src/modules/alertas/services/escalamiento.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { AlertaCriticaService } from './alerta-critica.service';
import { TriageEventPublisher } from 'src/modules/eventos/publishers/triage-event.publisher';
import { TriageGateway } from 'src/modules/websockets/gateways/triage.gateway';
import { EscalarAlertaDto } from '../dto/escalar-alerta.dto';
import { tipo_alerta_critica } from '@prisma/client';

@Injectable()
export class EscalamientoService {
  private readonly logger = new Logger(EscalamientoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertaCriticaService: AlertaCriticaService,
    private readonly eventPublisher: TriageEventPublisher,
    private readonly triageGateway: TriageGateway,
  ) {}

  /**
   * Escala una alerta al jefe de guardia
   */
  async escalarAlerta(dto: EscalarAlertaDto): Promise<any> {
    this.logger.warn(
      `Escalando alerta ${dto.alerta_id} a jefe de guardia ${dto.jefe_guardia_id}`,
    );

    const alerta = await this.alertaCriticaService.obtenerPorId(dto.alerta_id);

        if (alerta.escalada) {
          this.logger.warn(`Alerta ${dto.alerta_id} ya fue escalada`);
          return alerta;
        }


    const turno = await this.prisma.turnos.findUnique({
      where: { id: alerta.turno_id },
      include: {
        pacientes: true,
      },
    });

    const alertaEscalada = await this.prisma.alertas_criticas.update({
      where: { id: dto.alerta_id },
      data: {
        escalada: true,
        escalada_en: new Date(),
        tipo_alerta: 'TRIAGE_ESCALADO' as tipo_alerta_critica,
      },
    });


    this.logger.log(`Alerta escalada a jefe de guardia`);

    const tiempoSinConfirmarMin = alerta.creado_en
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(alerta.creado_en).getTime()) / 60000,
          ),
        )
      : 0;

    await this.eventPublisher.publishAlertaEscalada({
      alerta_id: alertaEscalada.id,
      turno_id: alerta.turno_id,
      hospital_id: alerta.hospital_id,
      jefe_guardia_id: dto.jefe_guardia_id,
      razon_escalamiento: dto.razon_escalamiento,
      tiempo_sin_confirmar_min: tiempoSinConfirmarMin,
      nivel_triage: alerta.nivel_triage,
    });

    const usuarioPaciente = await this.prisma.usuarios.findUnique({
      where: { id: turno.pacientes.usuario_id },
    });

    const jefeGuardia = await this.prisma.usuarios.findUnique({
      where: { id: dto.jefe_guardia_id },
    });

    this.triageGateway.emitNotificacion(
      {
        tipo: 'warning',
        titulo: 'Alerta Escalada',
        mensaje: `Alerta crítica escalada: Paciente ${usuarioPaciente?.nombre || 'Desconocido'} ${usuarioPaciente?.apellido || ''} - Turno ${turno.numero_turno} - Nivel ${alerta.nivel_triage}`,
        timestamp: new Date().toISOString(),
      },
      alerta.hospital_id,
      `dashboard:jefe-guardia:${alerta.hospital_id}`,
    );

    this.triageGateway.emitToDashboardMedicos(
      alerta.hospital_id,
      'alerta:escalada',
      {
        alerta_id: alertaEscalada.id,
        turno_id: alerta.turno_id,
        numero_turno: turno.numero_turno,
        paciente_nombre: usuarioPaciente?.nombre || 'Desconocido',
        paciente_apellido: usuarioPaciente?.apellido || '',
        nivel_triage: alerta.nivel_triage,
        jefe_guardia_nombre: jefeGuardia
          ? `${jefeGuardia.nombre} ${jefeGuardia.apellido}`
          : 'Desconocido',
        razon: dto.razon_escalamiento,
        timestamp: new Date().toISOString(),
      },
    );

    return alertaEscalada;
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
      this.logger.debug('No hay alertas pendientes de escalamiento');
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

        const tiempoEsperaMin = Math.floor(
          (Date.now() - new Date(alerta.creado_en).getTime()) / 60000,
        );

        await this.escalarAlerta({
          alerta_id: alerta.id,
          jefe_guardia_id: jefeGuardia.id,
          razon_escalamiento: `Escalamiento automático: Alerta no confirmada después de ${Math.floor((Date.now() - new Date(alerta.creado_en).getTime()) / 60000)} minutos`,
        });

        escaladas++;
      } catch (error: any) {
        this.logger.error(
          `Error al escalar alerta ${alerta.id}: ${error?.message || error}`,
        );
      }
    }


    this.logger.log(`Proceso completado - ${escaladas} alerta(s) escalada(s)`);

    return escaladas;
  }

  /**
  * Obtiene el jefe de guardia de un hospital
  */
  private async obtenerJefeGuardia(
    hospitalId: number,
  ): Promise<{ id: string } | null> {
    const medico = await this.prisma.medicos.findFirst({
      where: {
        activo: true,
        turnos: {
          some: {
            hospital_id: hospitalId,
          },
        },
      },
      include: {
        turnos: { select: { hospital_id: true }, take: 1 },
      },
    });

    if (medico) {
      const usuario = await this.prisma.usuarios.findFirst({
        where: {
          id: medico.usuario_id,
          rol: 'JEFE_GUARDIA',
          activo: true,
        },
        select: { id: true },
      });
      if (usuario) return usuario;
    }

    return await this.prisma.usuarios.findFirst({
      where: {
        rol: 'JEFE_GUARDIA',
        activo: true,
      },
      select: { id: true },
    });
  }
}