import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { ClassifierGatewayService } from './classifier-gateway.service';
import { CoreClientService } from '@/modules/core-client/core-client.service';
import { CoreNotifierService } from '@/modules/core-client/core-notifier.service';
import { TriageGateway } from '@/modules/websockets/gateways/triage.gateway';
import { TriageEventPublisher } from '@/modules/eventos/publishers/triage-event.publisher';
import { IngresoTriageDto } from '../dto/ingreso-triage.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { IngresoISISvoiceDto } from '../dto/ingreso-isisvoice.dto';
 
@Injectable()
export class RecepcionService {
  private readonly logger = new Logger(RecepcionService.name);
 
  constructor(
    private readonly prisma: PrismaService,
    private readonly classifierGateway: ClassifierGatewayService,
    private readonly coreClient: CoreClientService,
    private readonly coreNotifier: CoreNotifierService,
    private readonly triageGateway: TriageGateway,
    private readonly eventPublisher: TriageEventPublisher,
  ) {}
 
  async procesarIngreso(dto: IngresoTriageDto) {
    const tiempoInicio = Date.now();
    this.logger.log(`Procesando ingreso - Paciente: ${dto.paciente_id}, Hospital: ${dto.hospital_id}`);
 
    // 1. Sincronizar datos desde Core
    await this.coreClient.sincronizarPaciente(dto.paciente_id);
    await this.coreClient.sincronizarEnfermero(dto.enfermero_id);
 
    // 2. Generar número de turno
    const hoy = new Date();
    const inicioDelDia = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
    const finDelDia   = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + 1));
    const ultimoTurno = await this.prisma.turnos.findFirst({
      where: {
        hospital_id: dto.hospital_id,
        tipo_turno: 'URGENCIA',
        fecha: { gte: inicioDelDia, lt: finDelDia },
      },
      orderBy: { numero_turno: 'desc' },
      select: { numero_turno: true },
    });
    const numeroTurno = (ultimoTurno?.numero_turno ?? 0) + 1;
 
    // 3. Crear turno
    const turno = await this.prisma.turnos.create({
      data: {
        hospital_id: dto.hospital_id,
        paciente_id: dto.paciente_id,
        enfermero_triage_id: dto.enfermero_id,
        tipo_turno: 'URGENCIA',
        numero_turno: numeroTurno,
        estado: 'CLASIFICACION_PENDIENTE',
        fecha: hoy,
      },
    });
 
    this.logger.log(`Turno creado: ${turno.id} - Número: ${numeroTurno}`);
 
    // 4. Calcular campos derivados
    const pam = (dto.presion_sistolica + 2 * dto.presion_diastolica) / 3;
    const shockIndex = dto.frecuencia_cardiaca / dto.presion_sistolica;
    const alertasVitales = this.detectarAlertasVitales(dto, pam, shockIndex);
 
    // 5. Llamar a Random Forest
    let clasificacion;
    try {
      clasificacion = await this.classifierGateway.clasificar({
        sintomas: dto.sintomas,
        embarazo: dto.embarazo,
        antecedentes: dto.antecedentes,
        nivel_preliminar: dto.nivel_preliminar_isisvoice,
        presion_sistolica: dto.presion_sistolica,
        presion_diastolica: dto.presion_diastolica,
        frecuencia_cardiaca: dto.frecuencia_cardiaca,
        frecuencia_respiratoria: dto.frecuencia_respiratoria,
        temperatura: dto.temperatura,
        saturacion_oxigeno: dto.saturacion_oxigeno,
        presion_arterial_media: pam,
        shock_index: shockIndex,
      });
    } catch (error: any) {
      this.logger.error(`Random Forest falló: ${error?.message}`);
      clasificacion = this.fallbackClasificacion(
        dto.nivel_preliminar_isisvoice,
        alertasVitales.length > 0,
      );
    }
 
    // 6. Guardar registro de triage (todo junto)
    const registro = await this.prisma.registros_triage.create({
      data: {
        paciente_id: dto.paciente_id,
        hospital_id: dto.hospital_id,
        enfermero_id: dto.enfermero_id,
 
        // Síntomas (de ISISvoice)
        sintomas: dto.sintomas,
        embarazo: dto.embarazo,
        antecedentes: dto.antecedentes,
        posibles_causas: dto.posibles_causas || [],
        nivel_preliminar_isisvoice: dto.nivel_preliminar_isisvoice,
        comentario_paciente: dto.comentario_paciente || null,
 
        // Vitales (de ISISvoice)
        presion_sistolica: dto.presion_sistolica,
        presion_diastolica: dto.presion_diastolica,
        frecuencia_cardiaca: dto.frecuencia_cardiaca,
        frecuencia_respiratoria: dto.frecuencia_respiratoria,
        temperatura: new Decimal(dto.temperatura.toFixed(2)),
        saturacion_oxigeno: dto.saturacion_oxigeno,
        peso_kg: dto.peso_kg ? new Decimal(dto.peso_kg.toFixed(2)) : null,
        altura_cm: dto.altura_cm || null,
 
        // Campos calculados
        presion_arterial_media: new Decimal(pam.toFixed(2)),
        shock_index: new Decimal(shockIndex.toFixed(2)),
        tiene_alertas_vitales: alertasVitales.length > 0,
 
        // Clasificación IA
        nivel_sugerido_ia: clasificacion.nivel_sugerido,
        confianza_ia: new Decimal(clasificacion.confianza.toFixed(4)),
        comentarios_ia: clasificacion.comentarios || null,
 
        // Probabilidades
        probabilidad_nivel_1: clasificacion.probabilidades?.nivel_1
          ? new Decimal(clasificacion.probabilidades.nivel_1.toFixed(4)) : null,
        probabilidad_nivel_2: clasificacion.probabilidades?.nivel_2
          ? new Decimal(clasificacion.probabilidades.nivel_2.toFixed(4)) : null,
        probabilidad_nivel_3: clasificacion.probabilidades?.nivel_3
          ? new Decimal(clasificacion.probabilidades.nivel_3.toFixed(4)) : null,
        probabilidad_nivel_4: clasificacion.probabilidades?.nivel_4
          ? new Decimal(clasificacion.probabilidades.nivel_4.toFixed(4)) : null,
        probabilidad_nivel_5: clasificacion.probabilidades?.nivel_5
          ? new Decimal(clasificacion.probabilidades.nivel_5.toFixed(4)) : null,
 
        // Features
        feature_mas_importante: clasificacion.feature_mas_importante || null,
        valor_feature_importante: clasificacion.valor_feature_importante
          ? new Decimal(clasificacion.valor_feature_importante.toFixed(4)) : null,
 
        // Info
        motivo_consulta: dto.motivo_consulta,
        observaciones: dto.observaciones_enfermero || null,
        tiempo_registro_ms: Date.now() - tiempoInicio,
      },
    });
 
    // 7. Actualizar turno
    await this.prisma.turnos.update({
      where: { id: turno.id },
      data: {
        estado: 'ESPERANDO_CONFIRMACION',
        registro_triage_id: registro.id,
        actualizado_en: new Date(),
      },
    });
 
    // 8. Crear alerta si vitales críticos
    if (alertasVitales.length > 0) {
      const alerta = await this.prisma.alertas_criticas.create({
        data: {
          turno_id: turno.id,
          hospital_id: dto.hospital_id,
          nivel_triage: clasificacion.nivel_sugerido,
          tipo_alerta: 'TRIAGE_CRITICO_PRELIMINAR',
          confirmada: false,
          escalada: false,
          activa: true,
        },
      });
 
      this.triageGateway.emitAlertaCritica(
        {
          alerta_id: alerta.id,
          turno_id: turno.id,
          numero_turno: turno.numero_turno,
          paciente_nombre: 'Paciente',
          nivel_triage: clasificacion.nivel_sugerido,
          tipo_alerta: 'TRIAGE_CRITICO_PRELIMINAR',
          timestamp: new Date().toISOString(),
        },
        dto.hospital_id,
      );
    }
 
    // 9. Notificar WebSocket
    this.triageGateway.emitToDashboardEnfermeros(dto.hospital_id, 'clasificacion:lista', {
      turno_id: turno.id,
      numero_turno: numeroTurno,
      nivel_sugerido: clasificacion.nivel_sugerido,
      confianza: clasificacion.confianza,
      tiene_alertas: alertasVitales.length > 0,
      alertas: alertasVitales,
    });
 
    // 10. Notificar a Core
    await this.coreNotifier.notificarTurnoCreado({
      turno_id: turno.id,
      numero_turno: numeroTurno,
      hospital_id: dto.hospital_id,
      paciente_id: dto.paciente_id,
      tipo_turno: 'URGENCIA',
      estado: 'ESPERANDO_CONFIRMACION',
      fecha: new Date().toISOString(),
    });
 
    // 11. Publicar evento RabbitMQ
    await this.eventPublisher.publishTurnoCreado({
      turno_id: turno.id,
      numero_turno: numeroTurno,
      hospital_id: dto.hospital_id,
      paciente_id: dto.paciente_id,
      tipo_turno: 'URGENCIA',
      estado: 'ESPERANDO_CONFIRMACION',
      fecha: new Date().toISOString(),
    });
 
    this.logger.log(
      `Ingreso procesado - Turno: ${turno.id}, Nivel sugerido: ${clasificacion.nivel_sugerido}, Confianza: ${clasificacion.confianza}`,
    );
 
    // Respuesta para ISISvoice
    return {
      turno_id: turno.id,
      numero_turno: numeroTurno,
      registro_triage_id: registro.id,
      nivel_sugerido_ia: clasificacion.nivel_sugerido,
      confianza_ia: clasificacion.confianza,
      alertas_vitales: alertasVitales,
      estado: 'ESPERANDO_CONFIRMACION',
    };
  }
 
  private detectarAlertasVitales(dto: IngresoTriageDto, pam: number, shockIndex: number): string[] {
    const alertas: string[] = [];
 
    if (pam < 65) alertas.push('Hipotensión (PAM < 65 mmHg)');
    if (dto.frecuencia_cardiaca > 100) alertas.push('Taquicardia (FC > 100 lpm)');
    if (shockIndex > 1.0) alertas.push('Shock Index elevado (SI > 1.0)');
    if (dto.saturacion_oxigeno < 92) alertas.push('Hipoxemia (SpO2 < 92%)');
    if (dto.frecuencia_respiratoria > 24) alertas.push('Taquipnea (FR > 24 rpm)');
    if (dto.temperatura > 39) alertas.push('Fiebre alta (T > 39°C)');
 
    if (alertas.length > 0) {
      this.logger.warn(`Alertas vitales: ${alertas.join(', ')}`);
    }
    return alertas;
  }
 
  private fallbackClasificacion(nivelPreliminar: number, tieneAlertas: boolean) {
    return {
      nivel_sugerido: tieneAlertas && nivelPreliminar > 1 ? nivelPreliminar - 1 : nivelPreliminar,
      confianza: 0.5,
      comentarios: 'Clasificación fallback (Random Forest no disponible)',
      probabilidades: null,
    };
  }

    async procesarIngresoISISvoice(
  isisDto: IngresoISISvoiceDto,
  hospitalId: number,
  enfermeroId: string,
) {
  this.logger.log(
    `Ingreso ISISvoice — patient_id: ${isisDto.patient_id}, Procedure: ${isisDto.procedure_id}`,
  );

  const paciente = await this.coreClient.buscarPacientePorDocumento(
    isisDto.patient_id,
  );

  const dto: IngresoTriageDto = {
    paciente_id: paciente.id,
    hospital_id: hospitalId,
    enfermero_id: enfermeroId,

    motivo_consulta:
      isisDto.transcript ||
      isisDto.preliminary_history.comentario ||
      'Sin descripción registrada',

    sintomas: isisDto.preliminary_history.sintomas ?? [],
    embarazo: isisDto.preliminary_history.embarazo ?? false,
    antecedentes: isisDto.preliminary_history.antecedentes ?? [],
    posibles_causas: isisDto.preliminary_history.posiblesCausas ?? [],
    nivel_preliminar_isisvoice: isisDto.preliminary_history.nivelPrioridad ?? 3,
    comentario_paciente: isisDto.preliminary_history.comentario,

    presion_sistolica: isisDto.vital_signs.systolic_bp_mmhg,
    presion_diastolica: isisDto.vital_signs.diastolic_bp_mmhg,
    frecuencia_cardiaca: isisDto.vital_signs.heart_rate_bpm,
    frecuencia_respiratoria: isisDto.vital_signs.respiratory_rate_bpm,
    temperatura: isisDto.vital_signs.temperature_c,
    saturacion_oxigeno: isisDto.vital_signs.oxygen_saturation_pct,
    peso_kg: isisDto.vital_signs.weight_kg,
    altura_cm: isisDto.vital_signs.height_cm,

    observaciones_enfermero: isisDto.preliminary_history.comentariosIA
      ? `IA: ${isisDto.preliminary_history.comentariosIA}`
      : undefined,
  };

  return this.procesarIngreso(dto);
}
}

