// src/modules/evaluacion/evaluacion.service.ts

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TriageEventPublisher } from '../eventos/publishers/triage-event.publisher';
import { TriageGateway } from '../websockets/triage.gateway';
import { GuardarEvaluacionDto } from './dto/guardar-evaluacion.dto';
import { EvaluacionResponseDto } from './dto/evaluacion-response.dto';

@Injectable()
export class EvaluacionService {
  private readonly logger = new Logger(EvaluacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: TriageEventPublisher,
    private readonly triageGateway: TriageGateway,
  ) {}

  /**
   * Guarda la evaluación preliminar recibida de Ollama
   * Este método es llamado por el webhook de Ollama
   */
  async guardarEvaluacionPreliminar(dto: GuardarEvaluacionDto): Promise<EvaluacionResponseDto> {
    this.logger.log(`Guardando evaluación preliminar - Turno: ${dto.turno_id}`);

    // 1. Validar que el turno exista y esté en el estado correcto
    const turno = await this.prisma.turnos.findUnique({
      where: { id: dto.turno_id },
    });

    if (!turno) {
      throw new NotFoundException(`Turno ${dto.turno_id} no encontrado`);
    }

    if (turno.estado !== 'CUESTIONARIO_PENDIENTE') {
      throw new BadRequestException(
        `El turno ya fue procesado (estado actual: ${turno.estado})`
      );
    }

    // 2. Guardar evaluación preliminar
    const evaluacion = await this.prisma.evaluaciones_preliminares.create({
      data: {
        paciente_id: turno.paciente_id,
        hospital_id: turno.hospital_id,
        turno_id: dto.turno_id,

        // Datos de triage_data
        sintomas: dto.triage_data.sintomas,
        embarazo: dto.triage_data.embarazo,
        antecedentes: dto.triage_data.antecedentes,
        posibles_causas: dto.triage_data.posiblesCausas,
        nivel_prioridad: dto.triage_data.nivelPrioridad,
        comentario_paciente: dto.triage_data.comentario || null,
        comentarios_ia: dto.triage_data.comentariosIA || null,
        advertencia_ia: dto.triage_data.advertenciaIA || 'Contenido generado con IA; puede contener errores.',

        // Metadatos de Ollama
        confidence_score: dto.confidence_score,
        procedure_id: dto.procedure_id,
        status: dto.status,
      },
    });

    // 3. Actualizar turno
    await this.prisma.turnos.update({
      where: { id: dto.turno_id },
      data: {
        estado: 'ESPERANDO_VITALES',
        actualizado_en: new Date(),
      },
    });

    this.logger.log(
      `Evaluación guardada exitosamente - ID: ${evaluacion.id}, Nivel prioridad: ${evaluacion.nivel_prioridad}`
    );

    // 4. Publicar evento RabbitMQ
    await this.eventPublisher.publishEvaluacionCompletada({
      evaluacion_id: evaluacion.id,
      turno_id: dto.turno_id,
      nivel_prioridad: evaluacion.nivel_prioridad,
      hospital_id: turno.hospital_id,
      paciente_id: turno.paciente_id,
      sintomas: evaluacion.sintomas,
    });

    // 5. WebSocket a dashboard de enfermeros
    this.triageGateway.emitToHospital(turno.hospital_id, 'evaluacion:completada', {
      turno_id: dto.turno_id,
      numero_turno: turno.numero_turno,
      nivel_prioridad: evaluacion.nivel_prioridad,
      sintomas: evaluacion.sintomas,
      comentario: evaluacion.comentario_paciente,
      embarazo: evaluacion.embarazo,
    });

    // 6. WebSocket específico a dashboard de enfermeros
    this.triageGateway.emitToDashboardEnfermeros(turno.hospital_id, 'nuevo:paciente:esperando:vitales', {
      turno_id: dto.turno_id,
      numero_turno: turno.numero_turno,
      nivel_prioridad: evaluacion.nivel_prioridad,
    });

    return evaluacion as EvaluacionResponseDto;
  }

  /**
   * Obtener evaluación por ID
   */
  async obtenerEvaluacion(id: string): Promise<EvaluacionResponseDto> {
    const evaluacion = await this.prisma.evaluaciones_preliminares.findUnique({
      where: { id },
      include: {
        pacientes: true,
        turnos: true,
      },
    });

    if (!evaluacion) {
      throw new NotFoundException(`Evaluación ${id} no encontrada`);
    }

    return evaluacion as EvaluacionResponseDto;
  }

  /**
   * Obtener evaluación por turno_id
   */
  async obtenerEvaluacionPorTurno(turno_id: string): Promise<EvaluacionResponseDto> {
    const evaluacion = await this.prisma.evaluaciones_preliminares.findFirst({
      where: { turno_id },
      include: {
        pacientes: true,
        turnos: true,
      },
    });

    if (!evaluacion) {
      throw new NotFoundException(`No se encontró evaluación para el turno ${turno_id}`);
    }

    return evaluacion as EvaluacionResponseDto;
  }

  /**
   * Obtener evaluaciones pendientes por hospital (esperando vitales)
   */
  async obtenerEvaluacionesPendientes(hospital_id: number) {
    const evaluaciones = await this.prisma.evaluaciones_preliminares.findMany({
      where: {
        hospital_id,
        turnos: {
          estado: 'ESPERANDO_VITALES',
        },
      },
      include: {
        pacientes: {
          select: {
            id: true,
            numero_documento: true,
            tipo_documento: true,
            fecha_nacimiento: true,
          },
        },
        turnos: {
          select: {
            id: true,
            numero_turno: true,
            estado: true,
            creado_en: true,
          },
        },
      },
      orderBy: [
        { nivel_prioridad: 'asc' }, // Menor número = mayor prioridad
        { creado_en: 'asc' },
      ],
    });

    return evaluaciones;
  }
}