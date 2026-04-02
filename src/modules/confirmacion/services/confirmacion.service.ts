// src/modules/confirmacion/services/confirmacion.service.ts

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfirmarTriageDto } from '../dto/confirmar-triage.dto';
import { ConfirmacionResponse } from '../dto/confirmacion-response.dto';
import { TurnoService } from '@/modules/turnos/services/turno.service';
import { VitalesService } from '@/modules/vitales/services/vitales.service';
import { EstadoTurno } from '@/modules/turnos/entities/turno.entity';
import { ConfirmacionEnfermero } from '../entities/confirmacion-enfermero.entity';
import { ColaService } from '@/modules/cola/services/cola.service';
import { Inject } from '@nestjs/common';
import { TriageGateway } from '@/modules/websockets/gateways/triage.gateway';
import { TriageEventPublisher } from '@/modules/eventos/publishers/triage-event.publisher';

@Injectable()
export class ConfirmacionService {
  private readonly logger = new Logger(ConfirmacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly turnoService: TurnoService,
    private readonly vitalesService: VitalesService,
    private readonly colaService: ColaService,
    @Inject(TriageGateway)
    private readonly triageGateway: TriageGateway,
    private readonly eventPublisher: TriageEventPublisher,
  ) {}

  /**
   * Confirma o ajusta el nivel de triage sugerido por IA
   * Paso 15-17 del flujo de triage
   */
  async confirmarTriage(dto: ConfirmarTriageDto): Promise<ConfirmacionResponse> {
    this.logger.log(
      `Confirmando triage - Turno: ${dto.turno_id} - Nivel final: ${dto.nivel_final_enfermero}`,
    );

    const turno = await this.turnoService.obtenerPorId(dto.turno_id);

    if (turno.estado !== EstadoTurno.TRIAGE_COMPLETO) {
      throw new BadRequestException(
        `El turno debe estar en estado TRIAGE_COMPLETO. Estado actual: ${turno.estado}`,
      );
    }

    const registroTriage = await this.vitalesService.obtenerPorId(dto.registro_triage_id);

    if (!registroTriage) {
      throw new NotFoundException('Registro de triage no encontrado');
    }

    if (!dto.acepto_sugerencia && !dto.razon_modificacion) {
      throw new BadRequestException(
        'Debe proporcionar una razón si modifica la sugerencia de la IA',
      );
    }

    const cuestionario = registroTriage.cuestionario;
    const nivelPreliminar = cuestionario?.nivel_sugerido_ia_preliminar;

    const confirmacion = await this.prisma.confirmaciones_enfermero.create({
      data: {
        registro_triage_id: dto.registro_triage_id,
        enfermero_id: dto.enfermero_id,
        nivel_sugerido_ia_preliminar: nivelPreliminar,
        nivel_sugerido_ollama: registroTriage.nivel_sugerido_ia,
        nivel_final_enfermero: dto.nivel_final_enfermero,
        acepto_sugerencia: dto.acepto_sugerencia,
        razon_modificacion: dto.razon_modificacion,
        tiempo_evaluacion_ms: dto.tiempo_evaluacion_ms,
      },
      include: {
        registro_triage: true,
        enfermeros: {
          include: {
            usuarios: true,
          },
        },
      },
    });

    this.logger.log(`Confirmación guardada: ${confirmacion.id}`);


    await this.prisma.registros_triage.update({
      where: { id: dto.registro_triage_id },
      data: {
        nivel_triage_id: dto.nivel_final_enfermero,
      },
    });

    await this.prisma.turnos.update({
      where: { id: dto.turno_id },
      data: {
        nivel_triage_id: dto.nivel_final_enfermero,
        registro_triage_id: dto.registro_triage_id,
        enfermero_triage_id: dto.enfermero_id,
        estado: EstadoTurno.EN_ESPERA,
      },
    });

    this.logger.log(
      `Turno actualizado a EN_ESPERA - Nivel: ${dto.nivel_final_enfermero}`,
    );

    const posicionCola = await this.colaService.agregarACola(
      dto.turno_id,
      registroTriage.hospital_id,
      dto.nivel_final_enfermero,
    );
    this.logger.log(`Turno agregado a cola - Posición: ${posicionCola + 1}`);

    if (!dto.acepto_sugerencia) {
      const diferencia = Math.abs(
        dto.nivel_final_enfermero - registroTriage.nivel_sugerido_ia,
      );
      const tipoModificacion =
        dto.nivel_final_enfermero < registroTriage.nivel_sugerido_ia
          ? 'ESCALAMIENTO'
          : 'DEGRADACIÓN';

      this.logger.warn(
        `${tipoModificacion} de nivel - IA: ${registroTriage.nivel_sugerido_ia} → Enfermero: ${dto.nivel_final_enfermero} (Δ${diferencia}) - Razón: ${dto.razon_modificacion}`,
      );
    }

    const alertaCritica = dto.nivel_final_enfermero <= 2;

    if (alertaCritica) {
      this.logger.warn(
        `ALERTA CRÍTICA - Nivel ${dto.nivel_final_enfermero} confirmado - Turno: ${dto.turno_id}`,
      );
      // TODO: Crear alerta crítica en módulo de alertas
    }

    this.triageGateway.emitTriageConfirmado(
      {
        turno_id: dto.turno_id,
        confirmacion_id: confirmacion.id,
        nivel_final: dto.nivel_final_enfermero,
        acepto_sugerencia: dto.acepto_sugerencia,
        posicion_cola: posicionCola + 1,
        timestamp: new Date().toISOString(),
      },
      registroTriage.hospital_id,
    );

    await this.eventPublisher.publishTriageConfirmado({
      turno_id: dto.turno_id,
      confirmacion_id: confirmacion.id,
      registro_triage_id: dto.registro_triage_id,
      paciente_id: registroTriage.paciente_id,
      hospital_id: registroTriage.hospital_id,
      enfermero_id: dto.enfermero_id,
      nivel_sugerido_ollama: registroTriage.nivel_sugerido_ia,
      nivel_final_enfermero: dto.nivel_final_enfermero,
      acepto_sugerencia: dto.acepto_sugerencia,
      razon_modificacion: dto.razon_modificacion,
      posicion_cola: posicionCola + 1,
    });

    return {
      confirmacion: confirmacion as ConfirmacionEnfermero,
      mensaje: alertaCritica
        ? `Triage confirmado - NIVEL ${dto.nivel_final_enfermero} - PRIORIDAD MÁXIMA`
        : `Triage confirmado exitosamente - Nivel ${dto.nivel_final_enfermero}`,
      siguiente_paso: 'EN_ESPERA',
      posicion_en_cola: posicionCola + 1, // ← ACTUALIZAR (sumar 1 porque es 0-based)
      alerta_critica: alertaCritica,
    };
  }

  /**
   * Obtiene una confirmación por ID
   */
  async obtenerPorId(id: string): Promise<ConfirmacionEnfermero> {
    const confirmacion = await this.prisma.confirmaciones_enfermero.findUnique({
      where: { id },
      include: {
        registro_triage: {
          include: {
            pacientes: {
              include: {
                usuarios: true,
              },
            },
            cuestionario: true,
          },
        },
        enfermeros: {
          include: {
            usuarios: true,
          },
        },
      },
    });

    if (!confirmacion) {
      throw new NotFoundException('Confirmación no encontrada');
    }

    return confirmacion as ConfirmacionEnfermero;
  }

  /**
   * Obtiene confirmaciones de un enfermero
   */
  async obtenerPorEnfermero(
    enfermeroId: string,
    limite: number = 50,
  ): Promise<ConfirmacionEnfermero[]> {
    const confirmaciones = await this.prisma.confirmaciones_enfermero.findMany({
      where: { enfermero_id: enfermeroId },
      include: {
        registro_triage: {
          include: {
            pacientes: {
              include: {
                usuarios: true,
              },
            },
          },
        },
      },
      orderBy: {
        creado_en: 'desc',
      },
      take: limite,
    });

    return confirmaciones as ConfirmacionEnfermero[];
  }
}