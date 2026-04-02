// src/modules/cuestionario/services/cuestionario-triage.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EvaluarCuestionarioDto } from '../dto/evaluar-cuestionario.dto';
import { CuestionarioResponse } from '../dto/cuestionario-response.dto';
import { OllamaGatewayService } from './ollama-gateway.service';
import { TurnoService } from '@/modules/turnos/services/turno.service';
import { EstadoTurno } from '@/modules/turnos/entities/turno.entity';
import { CuestionarioTriage } from '../entities/cuestionario-triage.entity';
import { Inject } from '@nestjs/common';
import { TriageGateway } from '@/modules/websockets/gateways/triage.gateway';

@Injectable()
export class CuestionarioTriageService {
  private readonly logger = new Logger(CuestionarioTriageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ollamaGateway: OllamaGatewayService,
    private readonly turnoService: TurnoService,
    @Inject(TriageGateway)
    private readonly triageGateway: TriageGateway,
  ) {}

  /**
   * Evalúa el cuestionario del paciente
   * Paso 4-8 del flujo de triage
   */
  async evaluarCuestionario(dto: EvaluarCuestionarioDto): Promise<CuestionarioResponse> {
    this.logger.log(
      `Iniciando evaluación de cuestionario - Turno: ${dto.turno_id}`,
    );

    const turno = await this.turnoService.obtenerPorId(dto.turno_id);

    if (turno.estado !== EstadoTurno.CUESTIONARIO_PENDIENTE) {
      throw new BadRequestException(
        `El turno debe estar en estado CUESTIONARIO_PENDIENTE. Estado actual: ${turno.estado}`,
      );
    }

    const scoreTotal = dto.respuestas.reduce((sum, r) => sum + r.valor, 0);
    const scoreMax = Math.max(...dto.respuestas.map(r => r.valor));

    this.logger.debug(
      `Scores calculados - Total: ${scoreTotal}, Max: ${scoreMax}`,
    );

    let resultadoIA;
    let requirioOllama = false;

    if (scoreTotal < 15 && scoreMax <= 3) {
      this.logger.debug('Caso leve - Sin necesidad de Ollama');
      
      resultadoIA = {
        nivel_sugerido: scoreTotal < 10 ? 5 : 4,
        sintomas_detectados: this.extraerSintomasSimples(dto.respuestas),
        razon_clinica: 'Evaluación inicial indica condición no urgente',
        confianza: 0.85,
        requirio_ollama: false,
      };
    } else {

      this.logger.debug('Invocando Ollama para evaluación preliminar');
      
      resultadoIA = await this.ollamaGateway.evaluarPreliminar({
        categoria: dto.categoria,
        respuestas: dto.respuestas,
        score_total: scoreTotal,
        score_max: scoreMax,
        motivo_texto_libre: dto.motivo_texto_libre,
      });

      requirioOllama = resultadoIA.requirio_ollama;
    }

    const cuestionario = await this.prisma.cuestionario_triage.create({
      data: {
        paciente_id: dto.paciente_id,
        hospital_id: dto.hospital_id,
        turno_id: dto.turno_id,
        categoria_molestia: dto.categoria,
        respuestas: dto.respuestas as any,
        score_total: scoreTotal,
        score_max: scoreMax,
        motivo_texto_libre: dto.motivo_texto_libre,
        nivel_sugerido_ia_preliminar: resultadoIA.nivel_sugerido,
        confianza_ia_preliminar: resultadoIA.confianza,
        sintomas_detectados_ia: resultadoIA.sintomas_detectados,
        razon_clinica_ia: resultadoIA.razon_clinica,
        tiempo_llenado_ms: dto.tiempo_llenado_ms,
        requirio_ollama: requirioOllama,
      },
    });

    this.logger.log(`Cuestionario guardado: ${cuestionario.id}`);

    await this.turnoService.actualizarEstado(dto.turno_id, {
      estado: EstadoTurno.ESPERANDO_VITALES,
    });

    this.logger.log(
      `Turno actualizado a ESPERANDO_VITALES - Nivel preliminar: ${resultadoIA.nivel_sugerido}`,
    );

    const alertaCritica = resultadoIA.nivel_sugerido === 1;

    if (alertaCritica) {
      this.logger.warn(
        `ALERTA CRÍTICA DETECTADA - Turno: ${dto.turno_id} - Nivel: 1`,
      );
      // TODO: Crear alerta crítica (se implementará en módulo de alertas)
    }

    this.triageGateway.emitCuestionarioCompletado(
      {
        turno_id: dto.turno_id,
        cuestionario_id: cuestionario.id,
        nivel_preliminar: resultadoIA.nivel_sugerido,
        requirio_ollama: requirioOllama,
        timestamp: new Date().toISOString(),
      },
      dto.hospital_id,
    );

    // 8. TODO: Publicar evento RabbitMQ
    // this.eventPublisher.publish('triage.cuestionario.completado', ...)

    return {
      cuestionario: cuestionario as CuestionarioTriage,
      resultado_ia: resultadoIA,
      mensaje: alertaCritica
        ? 'Evaluación completada - ATENCIÓN INMEDIATA REQUERIDA'
        : 'Evaluación completada exitosamente',
      siguiente_paso: 'ESPERANDO_VITALES',
      alerta_critica: alertaCritica,
    };
  }

  /**
   * Obtiene un cuestionario por ID
   */
  async obtenerPorId(id: string): Promise<CuestionarioTriage> {
    const cuestionario = await this.prisma.cuestionario_triage.findUnique({
      where: { id },
      include: {
        pacientes: {
          include: {
            usuarios: true,
          },
        },
        hospitales: true,
        turnos: true,
        nivel_preliminar: true,
      },
    });

    if (!cuestionario) {
      throw new NotFoundException('Cuestionario no encontrado');
    }

    return cuestionario as CuestionarioTriage;
  }

  /**
   * Obtiene el cuestionario de un turno
   */
  async obtenerPorTurno(turnoId: string): Promise<CuestionarioTriage> {
    const cuestionario = await this.prisma.cuestionario_triage.findFirst({
      where: { turno_id: turnoId },
      include: {
        pacientes: {
          include: {
            usuarios: true,
          },
        },
        nivel_preliminar: true,
      },
    });

    if (!cuestionario) {
      throw new NotFoundException('Cuestionario no encontrado para este turno');
    }

    return cuestionario as CuestionarioTriage;
  }

  /**
   * Extrae síntomas simples de las respuestas
   */
  private extraerSintomasSimples(respuestas: any[]): string[] {
    return respuestas
      .filter(r => r.valor >= 3)
      .map(r => r.texto)
      .slice(0, 5);
  }
}