// src/modules/vitales/services/vitales.service.ts

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RegistrarVitalesDto } from '../dto/registrar-vitales.dto';
import { VitalesResponse } from '../dto/vitales-response.dto';
import { ClassifierGatewayService } from './classifier-gateway.service';
import { CuestionarioTriageService } from '@/modules/cuestionario/services/cuestionario-triage.service';
import { TurnoService } from '@/modules/turnos/services/turno.service';
import { EstadoTurno } from '@/modules/turnos/entities/turno.entity';
import { RegistroTriage, TipoEvaluacion } from '../entities/registro-triage.entity';
import { Inject } from '@nestjs/common';
import { TriageGateway } from '@/modules/websockets/gateways/triage.gateway';
import { TriageEventPublisher } from '@/modules/eventos/publishers/triage-event.publisher';

@Injectable()
export class VitalesService {
  private readonly logger = new Logger(VitalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly classifierGateway: ClassifierGatewayService,
    private readonly cuestionarioService: CuestionarioTriageService,
    private readonly turnoService: TurnoService,
    @Inject(TriageGateway)
    private readonly triageGateway: TriageGateway,
    private readonly eventPublisher: TriageEventPublisher,
  ) {}

  /**
   * Registra signos vitales y evalúa con Random Forest
   * Paso 13-14 del flujo de triage
   */
  async registrarVitalesYEvaluar(dto: RegistrarVitalesDto): Promise<VitalesResponse> {
    this.logger.log(
      `Registrando vitales - Turno: ${dto.turno_id}`,
    );

    const turno = await this.turnoService.obtenerPorId(dto.turno_id);

    if (turno.estado !== EstadoTurno.ESPERANDO_VITALES) {
      throw new BadRequestException(
        `El turno debe estar en estado ESPERANDO_VITALES. Estado actual: ${turno.estado}`,
      );
    }

    const cuestionario = await this.cuestionarioService.obtenerPorId(dto.cuestionario_id);

    if (!cuestionario) {
      throw new NotFoundException('Cuestionario no encontrado');
    }

    const paciente = await this.prisma.pacientes.findUnique({
      where: { id: dto.paciente_id },
      include: {
        usuarios: true,
      },
    });

    if (!paciente) {
      throw new NotFoundException('Paciente no encontrado');
    }

    const edad = this.calcularEdad(paciente.fecha_nacimiento);
    const sexo = 'M'; // NOTA: Agregar campo sexo a la tabla pacientes

    this.logger.debug(
      `Contexto del paciente - Edad: ${edad}, Sexo: ${sexo}`,
    );


    const contextoCompleto = {

      categoria: cuestionario.categoria_molestia,
      respuestas: cuestionario.respuestas,
      score_total: cuestionario.score_total,
      score_max: cuestionario.score_max,
      nivel_preliminar: cuestionario.nivel_sugerido_ia_preliminar,

      presion_sistolica: dto.presion_sistolica,
      presion_diastolica: dto.presion_diastolica,
      frecuencia_cardiaca: dto.frecuencia_cardiaca,
      frecuencia_respiratoria: dto.frecuencia_respiratoria,
      temperatura: dto.temperatura,
      saturacion_oxigeno: dto.saturacion_oxigeno,

      edad,
      sexo,
    };

    this.logger.debug('Invocando Random Forest para clasificación final');
    
    const resultadoClasificador = await this.classifierGateway.clasificarConVitales(
      contextoCompleto,
    );

    const registroTriage = await this.prisma.registros_triage.create({
      data: {
        paciente_id: dto.paciente_id,
        hospital_id: cuestionario.hospital_id,
        enfermero_id: dto.enfermero_id,
        cuestionario_id: dto.cuestionario_id,
        nivel_sugerido_ia: resultadoClasificador.nivel_sugerido,
        confianza_ia: resultadoClasificador.confianza,
        motivo_consulta: cuestionario.motivo_texto_libre || 'Urgencia médica',
        sintomas: resultadoClasificador.razon_clinica,
        presion_sistolica: dto.presion_sistolica,
        presion_diastolica: dto.presion_diastolica,
        frecuencia_cardiaca: dto.frecuencia_cardiaca,
        frecuencia_respiratoria: dto.frecuencia_respiratoria,
        temperatura: dto.temperatura,
        saturacion_oxigeno: dto.saturacion_oxigeno,
        observaciones: dto.observaciones,
        tipo_evaluacion: TipoEvaluacion.FINAL,
        tiempo_registro_ms: dto.tiempo_registro_ms,
        nivel_triage_id: null,
      },
    });

    this.logger.log(`Registro de triage guardado: ${registroTriage.id}`);

    await this.turnoService.actualizarEstado(dto.turno_id, {
      estado: EstadoTurno.TRIAGE_COMPLETO,
    });

    this.logger.log(
      `Turno actualizado a TRIAGE_COMPLETO - Nivel sugerido: ${resultadoClasificador.nivel_sugerido}`,
    );

    const alertasCriticas = resultadoClasificador.alertas_vitales.filter(
      alerta => ['HIPOTENSIÓN', 'HIPOXEMIA', 'TAQUICARDIA'].includes(alerta),
    );

    if (alertasCriticas.length > 0) {
      this.logger.warn(
        `Alertas vitales críticas detectadas: ${alertasCriticas.join(', ')}`,
      );
    }

    this.triageGateway.emitVitalesRegistrados(
      {
        turno_id: dto.turno_id,
        registro_triage_id: registroTriage.id,
        nivel_sugerido: resultadoClasificador.nivel_sugerido,
        confianza: resultadoClasificador.confianza,
        alertas_vitales: alertasCriticas,
        timestamp: new Date().toISOString(),
      },
      cuestionario.hospital_id,
    );

    await this.eventPublisher.publishVitalesRegistrados({
      turno_id: dto.turno_id,
      registro_triage_id: registroTriage.id,
      cuestionario_id: dto.cuestionario_id,
      paciente_id: dto.paciente_id,
      hospital_id: cuestionario.hospital_id,
      enfermero_id: dto.enfermero_id,
      nivel_sugerido_ia: resultadoClasificador.nivel_sugerido,
      confianza_ia: resultadoClasificador.confianza,
      vitales: {
        presion_sistolica: dto.presion_sistolica,
        presion_diastolica: dto.presion_diastolica,
        frecuencia_cardiaca: dto.frecuencia_cardiaca,
        frecuencia_respiratoria: dto.frecuencia_respiratoria,
        temperatura: dto.temperatura,
        saturacion_oxigeno: dto.saturacion_oxigeno,
      },
      alertas_vitales: alertasCriticas,
    });

    return {
      registro_triage: registroTriage as RegistroTriage,
      resultado_clasificador: resultadoClasificador,
      mensaje: alertasCriticas.length > 0
        ? `Vitales registrados - ${alertasCriticas.length} alerta(s) detectada(s)`
        : 'Vitales registrados exitosamente',
      siguiente_paso: 'TRIAGE_COMPLETO',
      alertas_criticas: alertasCriticas,
    };
  }

  /**
   * Obtiene un registro de triage por ID
   */
  async obtenerPorId(id: string): Promise<RegistroTriage> {
    const registro = await this.prisma.registros_triage.findUnique({
      where: { id },
      include: {
        pacientes: {
          include: {
            usuarios: true,
          },
        },
        enfermeros: {
          include: {
            usuarios: true,
          },
        },
        cuestionario: true,
        nivel_triage: true,
        nivel_sugerido: true,
      },
    });

    if (!registro) {
      throw new NotFoundException('Registro de triage no encontrado');
    }

    return registro as RegistroTriage;
  }

  /**
   * Obtiene el registro de triage de un turno
   */
  async obtenerPorTurno(turnoId: string): Promise<RegistroTriage> {
    const turno = await this.turnoService.obtenerPorId(turnoId);

    if (!turno.registro_triage_id) {
      throw new NotFoundException('Este turno no tiene registro de triage aún');
    }

    return this.obtenerPorId(turno.registro_triage_id);
  }

  /**
   * Calcula la edad a partir de la fecha de nacimiento
   */
  private calcularEdad(fechaNacimiento: Date | null): number {
    if (!fechaNacimiento) return 0;

    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }

    return edad;
  }
}