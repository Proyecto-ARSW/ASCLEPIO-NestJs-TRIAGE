// src/modules/confirmacion/confirmacion.service.ts

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ColaService } from '../cola/cola.service';
import { AlertaCriticaService } from '../alertas/services/alerta-critica.service';
import { TriageEventPublisher } from '../eventos/publishers/triage-event.publisher';
import { TriageGateway } from '../websockets/triage.gateway';
import { ConfirmarTriageDto } from './dto/confirmar-triage.dto';
import { ConfirmacionResponseDto } from './dto/confirmacion-response.dto';

@Injectable()
export class ConfirmacionService {
  private readonly logger = new Logger(ConfirmacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly colaService: ColaService,
    private readonly alertaService: AlertaCriticaService,
    private readonly eventPublisher: TriageEventPublisher,
    private readonly triageGateway: TriageGateway,
  ) {}

  /**
   * Confirma el nivel de triage sugerido por la IA
   */
  async confirmarTriage(dto: ConfirmarTriageDto): Promise<ConfirmacionResponseDto> {
    const tiempoInicio = Date.now();

    this.logger.log(`Confirmando triage - Registro: ${dto.registro_triage_id}`);

    // 1. Obtener registro de triage con evaluación preliminar
    const registro = await this.prisma.registros_triage.findUnique({
      where: { id: dto.registro_triage_id },
      include: {
        evaluacion_preliminar: true,
        turnos: true,
      },
    });

    if (!registro) {
      throw new NotFoundException(`Registro de triage ${dto.registro_triage_id} no encontrado`);
    }

    if (registro.nivel_triage_id !== null) {
      throw new BadRequestException('Este registro de triage ya fue confirmado');
    }

    const turno = registro.turnos[0];
    if (!turno) {
      throw new NotFoundException('No se encontró turno asociado al registro');
    }

    // 2. Determinar si aceptó la sugerencia
    const acepto_sugerencia = registro.nivel_sugerido_ia === dto.nivel_final;

    // 3. Calcular tipo de modificación
    let tipo_modificacion: string | null = null;
    let diferencia_niveles: number | null = null;

    if (!acepto_sugerencia) {
      diferencia_niveles = dto.nivel_final - registro.nivel_sugerido_ia;
      
      if (dto.nivel_final < registro.nivel_sugerido_ia) {
        tipo_modificacion = 'ESCALAMIENTO'; // Nivel menor = más urgente
      } else {
        tipo_modificacion = 'DEGRADACION'; // Nivel mayor = menos urgente
      }

      this.logger.log(
        `Enfermero modificó nivel: ${registro.nivel_sugerido_ia} → ${dto.nivel_final} (${tipo_modificacion})`
      );
    }

    // 4. Crear confirmación
    const confirmacion = await this.prisma.confirmaciones_enfermero.create({
      data: {
        registro_triage_id: dto.registro_triage_id,
        enfermero_id: dto.enfermero_id,
        nivel_sugerido_ia: registro.nivel_sugerido_ia,
        nivel_final_enfermero: dto.nivel_final,
        acepto_sugerencia,
        razon_modificacion: dto.razon_modificacion || null,
        tipo_modificacion,
        diferencia_niveles,
        tiempo_confirmacion_ms: Date.now() - tiempoInicio,
      },
    });

    // 5. Actualizar registro de triage con nivel final
    await this.prisma.registros_triage.update({
      where: { id: dto.registro_triage_id },
      data: {
        nivel_triage_id: dto.nivel_final,
      },
    });

    // 6. Actualizar turno
    await this.prisma.turnos.update({
      where: { id: turno.id },
      data: {
        estado: 'EN_ESPERA',
        nivel_triage_id: dto.nivel_final,
        actualizado_en: new Date(),
      },
    });

    // 7. Agregar a cola Redis
    await this.colaService.agregarACola({
      turno_id: turno.id,
      hospital_id: turno.hospital_id,
      nivel_triage: dto.nivel_final,
      paciente_id: turno.paciente_id,
      numero_turno: turno.numero_turno,
    });

    this.logger.log(
      `Triage confirmado - Nivel final: ${dto.nivel_final}, En cola: hospital:${turno.hospital_id}:cola:triage:${dto.nivel_final}`
    );

    // 8. Si es nivel crítico (1 o 2), crear alerta
    if (dto.nivel_final <= 2) {
      await this.alertaService.crearAlertaCritica({
        turno_id: turno.id,
        hospital_id: turno.hospital_id,
        nivel_triage: dto.nivel_final,
        tipo_alerta: dto.nivel_final === 1 ? 'TRIAGE_CRITICO' : 'TRIAGE_CRITICO',
      });
    }

    // 9. Publicar evento RabbitMQ
    await this.eventPublisher.publishTriageConfirmado({
      confirmacion_id: confirmacion.id,
      turno_id: turno.id,
      nivel_final: dto.nivel_final,
      acepto_sugerencia,
      hospital_id: turno.hospital_id,
      paciente_id: turno.paciente_id,
    });

    // 10. WebSocket
    this.triageGateway.emitToHospital(turno.hospital_id, 'triage:confirmado', {
      turno_id: turno.id,
      numero_turno: turno.numero_turno,
      nivel_final: dto.nivel_final,
      acepto_sugerencia,
    });

    // 11. Actualizar posición en cola vía WebSocket
    const posicion = await this.colaService.obtenerPosicionEnCola(
      turno.id,
      turno.hospital_id,
      dto.nivel_final
    );

    this.triageGateway.emitToPaciente(turno.id, 'posicion:actualizada', {
      turno_id: turno.id,
      nivel_triage: dto.nivel_final,
      posicion: posicion.posicion,
      pacientes_delante: posicion.pacientes_delante,
    });

    return confirmacion as ConfirmacionResponseDto;
  }

  /**
   * Obtener confirmación por ID
   */
  async obtenerConfirmacion(id: string): Promise<ConfirmacionResponseDto> {
    const confirmacion = await this.prisma.confirmaciones_enfermero.findUnique({
      where: { id },
      include: {
        registro_triage: {
          include: {
            evaluacion_preliminar: true,
          },
        },
        enfermero: {
          include: {
            usuarios: true,
          },
        },
      },
    });

    if (!confirmacion) {
      throw new NotFoundException(`Confirmación ${id} no encontrada`);
    }

    return confirmacion as any as ConfirmacionResponseDto;
  }

  /**
   * Obtener confirmaciones por enfermero
   */
  async obtenerConfirmacionesPorEnfermero(enfermero_id: string, limit: number = 50) {
    return this.prisma.confirmaciones_enfermero.findMany({
      where: { enfermero_id },
      include: {
        registro_triage: {
          include: {
            evaluacion_preliminar: true,
            pacientes: true,
          },
        },
      },
      orderBy: { creado_en: 'desc' },
      take: limit,
    });
  }
}