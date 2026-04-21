// src/modules/vitales/services/vitales.service.ts

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ClassifierGatewayService } from '../services/classifier-gateway.service';
import { RegistrarVitalesDto } from '../dto/registrar-vitales.dto';
import { VitalesResponseDto } from '../dto/vitales-response.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { TriageEventPublisher } from '../../eventos/publishers/triage-event.publisher';
import { TriageGateway } from '../../websockets/gateways/triage.gateway';
import { RedisService } from 'src/modules/cola/services/redis.service';

@Injectable()
export class VitalesService {
  private readonly logger = new Logger(VitalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly classifierGateway: ClassifierGatewayService,
    private readonly eventPublisher: TriageEventPublisher,
    private readonly triageGateway: TriageGateway,
    private readonly redis: RedisService,
  ) {}

  /**
   * Registra los signos vitales y llama al Random Forest para clasificación
   */
  async registrarVitales(dto: RegistrarVitalesDto): Promise<VitalesResponseDto> {
    const tiempoInicio = Date.now();

    this.logger.log(`Registrando vitales - Turno: ${dto.turno_id}`);

    // 1. Validar que el turno exista y esté en el estado correcto
    const turno = await this.prisma.turnos.findUnique({
      where: { id: dto.turno_id },
    });

    if (!turno) {
      throw new NotFoundException(`Turno ${dto.turno_id} no encontrado`);
    }

    if (turno.estado !== 'ESPERANDO_VITALES') {
      throw new BadRequestException(
        `El turno no está esperando vitales (estado actual: ${turno.estado})`,
      );
    }

    // 2. Obtener evaluación preliminar
    const evaluacion = await this.prisma.evaluaciones_preliminares.findFirst({
      where: { turno_id: dto.turno_id },
    });

    if (!evaluacion) {
      throw new NotFoundException(
        `No se encontró evaluación preliminar para el turno ${dto.turno_id}`,
      );
    }

    // 3. Calcular campos derivados
    const pam = this.calcularPresionArterialMedia(dto.presion_sistolica, dto.presion_diastolica);
    const shockIndex = this.calcularShockIndex(dto.frecuencia_cardiaca, dto.presion_sistolica);
    const alertasVitales = this.detectarAlertasVitales(dto, pam, shockIndex);
    const tieneAlertas = alertasVitales.length > 0;

    // 4. Construir payload para Random Forest
    const payloadRF = {
      sintomas: evaluacion.sintomas,
      embarazo: evaluacion.embarazo,
      antecedentes: evaluacion.antecedentes,
      nivel_preliminar: evaluacion.nivel_prioridad,

      presion_sistolica: dto.presion_sistolica,
      presion_diastolica: dto.presion_diastolica,
      frecuencia_cardiaca: dto.frecuencia_cardiaca,
      frecuencia_respiratoria: dto.frecuencia_respiratoria,
      temperatura: dto.temperatura,
      saturacion_oxigeno: dto.saturacion_oxigeno,

      presion_arterial_media: pam,
      shock_index: shockIndex,
    };

    // 5. Llamar a Random Forest para clasificación
    let clasificacion;
    try {
      clasificacion = await this.classifierGateway.clasificar(payloadRF);
    } catch (error: any) {
      this.logger.error(`Error al llamar al clasificador: ${error?.message || error}`);
      clasificacion = this.fallbackClasificacion(evaluacion.nivel_prioridad, tieneAlertas);
    }

    // 6. Guardar registro de triage
    const registro = await this.prisma.registros_triage.create({
      data: {
        paciente_id: dto.paciente_id,
        hospital_id: dto.hospital_id,
        enfermero_id: dto.enfermero_id,
        evaluacion_preliminar_id: evaluacion.id,

        presion_sistolica: dto.presion_sistolica,
        presion_diastolica: dto.presion_diastolica,
        frecuencia_cardiaca: dto.frecuencia_cardiaca,
        frecuencia_respiratoria: dto.frecuencia_respiratoria,
        temperatura: new Decimal(dto.temperatura.toFixed(2)),
        saturacion_oxigeno: dto.saturacion_oxigeno,
        peso_kg: dto.peso_kg ? new Decimal(dto.peso_kg.toFixed(2)) : null,
        altura_cm: dto.altura_cm || null,

        presion_arterial_media: new Decimal(pam.toFixed(2)),
        shock_index: new Decimal(shockIndex.toFixed(2)),
        tiene_alertas_vitales: tieneAlertas,

        nivel_sugerido_ia: clasificacion.nivel_sugerido,
        confianza_ia: new Decimal(clasificacion.confianza.toFixed(4)),
        comentarios_ia: clasificacion.comentarios || null,

        probabilidad_nivel_1: clasificacion.probabilidades?.nivel_1
          ? new Decimal(clasificacion.probabilidades.nivel_1.toFixed(4))
          : null,
        probabilidad_nivel_2: clasificacion.probabilidades?.nivel_2
          ? new Decimal(clasificacion.probabilidades.nivel_2.toFixed(4))
          : null,
        probabilidad_nivel_3: clasificacion.probabilidades?.nivel_3
          ? new Decimal(clasificacion.probabilidades.nivel_3.toFixed(4))
          : null,
        probabilidad_nivel_4: clasificacion.probabilidades?.nivel_4
          ? new Decimal(clasificacion.probabilidades.nivel_4.toFixed(4))
          : null,
        probabilidad_nivel_5: clasificacion.probabilidades?.nivel_5
          ? new Decimal(clasificacion.probabilidades.nivel_5.toFixed(4))
          : null,

        feature_mas_importante: clasificacion.feature_mas_importante || null,
        valor_feature_importante: clasificacion.valor_feature_importante
          ? new Decimal(clasificacion.valor_feature_importante.toFixed(4))
          : null,

        motivo_consulta: dto.motivo_consulta,
        sintomas_observados: dto.sintomas_observados || null,
        observaciones: dto.observaciones || null,
        tiempo_registro_ms: Date.now() - tiempoInicio,
      },
    });

    // 7. Actualizar turno
    await this.prisma.turnos.update({
      where: { id: dto.turno_id },
      data: {
        estado: 'TRIAGE_COMPLETO',
        registro_triage_id: registro.id,
        actualizado_en: new Date(),
      },
    });

    this.logger.log(
      `Vitales registrados - ID: ${registro.id}, Nivel sugerido: ${clasificacion.nivel_sugerido}`,
    );

    if (tieneAlertas) {
      await this.crearAlertaVitalesCriticos(
        dto.turno_id,
        dto.hospital_id,
        dto.paciente_id,
        clasificacion.nivel_sugerido,
        alertasVitales,
        turno.numero_turno,
      );
    }
    
    await this.eventPublisher.publishVitalesRegistrados({
      turno_id: dto.turno_id,
      registro_triage_id: registro.id,
      cuestionario_id: evaluacion.id,
      paciente_id: dto.paciente_id,
      hospital_id: dto.hospital_id,
      enfermero_id: dto.enfermero_id,
      nivel_sugerido_ia: clasificacion.nivel_sugerido,
      confianza_ia: clasificacion.confianza,
      vitales: {
        presion_sistolica: dto.presion_sistolica,
        presion_diastolica: dto.presion_diastolica,
        frecuencia_cardiaca: dto.frecuencia_cardiaca,
        frecuencia_respiratoria: dto.frecuencia_respiratoria,
        temperatura: dto.temperatura,
        saturacion_oxigeno: dto.saturacion_oxigeno,
      },
      alertas_vitales: alertasVitales,
    });
  


    this.triageGateway.emitToHospital(dto.hospital_id, 'vitales:registrados', {
      turno_id: dto.turno_id,
      numero_turno: turno.numero_turno,
      nivel_sugerido: clasificacion.nivel_sugerido,
      confianza: clasificacion.confianza,
      tiene_alertas: tieneAlertas,
      alertas_vitales: alertasVitales,
    });


    return registro as any as VitalesResponseDto;
  }

    /**
   * Crea alerta crítica cuando se detectan signos vitales fuera de rango
   */
  private async crearAlertaVitalesCriticos(
    turnoId: string,
    hospitalId: number,
    pacienteId: string,
    nivelSugerido: number,
    alertas: string[],
    numeroTurno: number,
  ): Promise<void> {
    try {
      const alertaExistente = await this.prisma.alertas_criticas.findFirst({
        where: {
          turno_id: turnoId,
          activa: true,
        },
      });

      if (alertaExistente) {
        this.logger.debug(`Ya existe alerta activa para turno ${turnoId}`);
        return;
      }

      const alerta = await this.prisma.alertas_criticas.create({
        data: {
          turno_id: turnoId,
          hospital_id: hospitalId,
          nivel_triage: nivelSugerido,
          tipo_alerta: 'TRIAGE_CRITICO_PRELIMINAR',
          activa: true,
        },
      });

      this.logger.warn(
        `Alerta vitales críticos creada - Turno: ${turnoId}, Alertas: ${alertas.join(', ')}`,
      );

      const paciente = await this.prisma.pacientes.findUnique({
        where: { id: pacienteId },
      });
      const usuario = paciente
        ? await this.prisma.usuarios.findUnique({ where: { id: paciente.usuario_id } })
        : null;

      this.triageGateway.emitAlertaCritica(
        {
          alerta_id: alerta.id,
          turno_id: turnoId,
          numero_turno: numeroTurno,
          paciente_nombre: usuario?.nombre || 'Desconocido',
          nivel_triage: nivelSugerido,
          tipo_alerta: 'TRIAGE_CRITICO_PRELIMINAR',
          timestamp: new Date().toISOString(),
        },
        hospitalId,
      );

      const redisService = (this.triageGateway as any).redis as import('src/modules/cola/services/redis.service').RedisService;
      if (redisService) {
        await redisService.publish(
          `hospital:${hospitalId}:alerta:critica`,
          JSON.stringify({
            alerta_id: alerta.id,
            turno_id: turnoId,
            numero_turno: numeroTurno,
            paciente_nombre: usuario?.nombre || 'Desconocido',
            nivel_triage: nivelSugerido,
            tipo_alerta: 'TRIAGE_CRITICO_PRELIMINAR',
            alertas_vitales: alertas,
            hospital_id: hospitalId,
            timestamp: new Date().toISOString(),
          }),
        );
      }

      await this.eventPublisher.publishAlertaCritica({
        alerta_id: alerta.id,
        turno_id: turnoId,
        hospital_id: hospitalId,
        paciente_id: pacienteId,
        nivel_triage: nivelSugerido,
        tipo_alerta: 'TRIAGE_CRITICO_PRELIMINAR',
      });
    } catch (error: any) {
      this.logger.error(
        `Error creando alerta de vitales críticos: ${error?.message || error}`,
      );
    }
  }

  /**
   * Calcular Presión Arterial Media (PAM)
   * PAM = (Sistólica + 2 × Diastólica) / 3
   */
  private calcularPresionArterialMedia(sistolica: number, diastolica: number): number {
    return (sistolica + 2 * diastolica) / 3;
  }

  /**
   * Calcular Shock Index
   * SI = Frecuencia Cardíaca / Presión Sistólica
   */
  private calcularShockIndex(fc: number, sistolica: number): number {
    return fc / sistolica;
  }

    /**
   * Detectar alertas vitales críticas
   * Retorna lista de alertas detectadas (vacía si no hay)
   */
  private detectarAlertasVitales(
    vitales: RegistrarVitalesDto,
    pam: number,
    shockIndex: number,
  ): string[] {
    const alertas: string[] = [];

    if (pam < 65) {
      alertas.push('Hipotensión (PAM < 65 mmHg)');
    }

    if (vitales.frecuencia_cardiaca > 120) {
      alertas.push('Taquicardia severa (FC > 120 bpm)');
    }

    if (vitales.frecuencia_cardiaca < 50) {
      alertas.push('Bradicardia (FC < 50 bpm)');
    }

    if (shockIndex > 1.0) {
      alertas.push('Shock Index elevado (SI > 1.0)');
    }

    if (vitales.saturacion_oxigeno < 90) {
      alertas.push('Hipoxemia severa (SpO2 < 90%)');
    }

    if (vitales.frecuencia_respiratoria > 24) {
      alertas.push('Taquipnea (FR > 24 rpm)');
    }

    if (vitales.frecuencia_respiratoria < 12) {
      alertas.push('Bradipnea (FR < 12 rpm)');
    }

    if (vitales.temperatura > 39) {
      alertas.push('Fiebre alta (T > 39°C)');
    }

    if (vitales.temperatura < 35) {
      alertas.push('Hipotermia (T < 35°C)');
    }

    if (vitales.presion_sistolica > 180) {
      alertas.push('Crisis hipertensiva (PAS > 180 mmHg)');
    }

    if (vitales.presion_sistolica < 90) {
      alertas.push('Hipotensión sistólica (PAS < 90 mmHg)');
    }

    if (alertas.length > 0) {
      this.logger.warn(`Alertas vitales detectadas: ${alertas.join(', ')}`);
    }

    return alertas;
  }


  /**
   * Fallback si el clasificador Random Forest falla
   */
  private fallbackClasificacion(nivel_preliminar: number, tiene_alertas: boolean) {
    let nivel_sugerido = nivel_preliminar;
    if (tiene_alertas && nivel_preliminar > 1) {
      nivel_sugerido = nivel_preliminar - 1;
    }

    return {
      nivel_sugerido,
      confianza: 0.5,
      comentarios:
        'Clasificación por fallback (Random Forest no disponible). Nivel basado en evaluación preliminar y alertas vitales.',
      probabilidades: null,
    };
  }

  /**
   * Obtener registro de vitales por ID
   */
  async obtenerRegistro(id: string): Promise<VitalesResponseDto> {
    const registro = await this.prisma.registros_triage.findUnique({
      where: { id },
      include: {
        evaluacion_preliminar: true,
        pacientes: true,
        enfermeros: true,
      },
    });

    if (!registro) {
      throw new NotFoundException(`Registro de vitales ${id} no encontrado`);
    }

    return registro as any as VitalesResponseDto;
  }

  /**
   * Obtener registro por turno_id
   */
  async obtenerRegistroPorTurno(turno_id: string): Promise<VitalesResponseDto> {
    const turno = await this.prisma.turnos.findUnique({
      where: { id: turno_id },
      include: {
        registro_triage: {
          include: {
            evaluacion_preliminar: true,
            pacientes: true,
            enfermeros: true,
          },
        },
      },
    });

    if (!turno || !turno.registro_triage) {
      throw new NotFoundException(`No se encontró registro de vitales para el turno ${turno_id}`);
    }

    return turno.registro_triage as any as VitalesResponseDto;
  }
}