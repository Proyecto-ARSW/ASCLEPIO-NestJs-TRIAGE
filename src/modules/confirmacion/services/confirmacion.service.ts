// src/modules/confirmacion/services/confirmacion.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ConfirmarTriageDto } from '../dto/confirmar-triage.dto';
import { ColaService } from 'src/modules/cola/services/cola.service';
import { TriageEventPublisher } from 'src/modules/eventos/publishers/triage-event.publisher';
import { TriageGateway } from 'src/modules/websockets/gateways/triage.gateway';

@Injectable()
export class ConfirmacionService {
  private readonly logger = new Logger(ConfirmacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly colaService: ColaService,
    private readonly eventPublisher: TriageEventPublisher,
    private readonly triageGateway: TriageGateway,
  ) {}

  /**
   * Confirma el nivel de triage y agrega el paciente a la cola de espera
   */
  async confirmarTriage(dto: ConfirmarTriageDto) {
    this.logger.log(`Confirmando triage - Registro: ${dto.registro_triage_id}`);

    // 1. Validar que el registro existe
    const registro = await this.prisma.registros_triage.findUnique({
      where: { id: dto.registro_triage_id },
    });

    if (!registro) {
      throw new NotFoundException(`Registro de triage ${dto.registro_triage_id} no encontrado`);
    }

    // 2. Buscar el turno asociado
    const turno = await this.prisma.turnos.findFirst({
      where: { registro_triage_id: dto.registro_triage_id },
      include: {
        pacientes: true,
      },
    });

    if (!turno) {
      throw new NotFoundException('No se encontró turno asociado al registro');
    }

    // 3. Validar que el enfermero existe
    const enfermero = await this.prisma.enfermeros.findUnique({
      where: { id: dto.enfermero_id },
    });

    if (!enfermero) {
      throw new NotFoundException(`Enfermero ${dto.enfermero_id} no encontrado`);
    }

    // 4. Validar que el nivel de triage existe
    const nivelTriage = await this.prisma.niveles_triage.findUnique({
      where: { id: dto.nivel_final },
    });

    if (!nivelTriage) {
      throw new BadRequestException(`Nivel de triage ${dto.nivel_final} no válido`);
    }

    // 5. Verificar si acepta sugerencia de IA
    const acepto_sugerencia = registro.nivel_sugerido_ia === dto.nivel_final;

    let tipo_modificacion: string | null = null;
    let diferencia_niveles: number | null = null;

    if (!acepto_sugerencia) {
      diferencia_niveles = dto.nivel_final - registro.nivel_sugerido_ia;

      if (dto.nivel_final < registro.nivel_sugerido_ia) {
        tipo_modificacion = 'ESCALAMIENTO';
      } else {
        tipo_modificacion = 'DEGRADACION';
      }

      this.logger.log(
        `Enfermero modificó nivel: ${registro.nivel_sugerido_ia} → ${dto.nivel_final} (${tipo_modificacion})`,
      );
    }

    // 6. Crear registro de confirmación
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
        tiempo_confirmacion_ms: 0,
      },
    });

    // 7. Actualizar registro de triage
    await this.prisma.registros_triage.update({
      where: { id: dto.registro_triage_id },
      data: {
        nivel_triage_id: dto.nivel_final,
      },
    });

    // 8. Actualizar turno
    await this.prisma.turnos.update({
      where: { id: turno.id },
      data: {
        estado: 'EN_ESPERA',
        nivel_triage_id: dto.nivel_final,
        actualizado_en: new Date(),
      },
    });

    // 9. Agregar a la cola de espera en Redis
    const posicion = await this.colaService.agregarACola(
      turno.id,
      turno.hospital_id,
      dto.nivel_final,
    );

    this.logger.log(
      `Triage confirmado - Turno: ${turno.numero_turno}, Nivel: ${dto.nivel_final}, Posición: ${posicion}`,
    );

    // 10. Verificar si necesita alerta crítica (Niveles 1 y 2)
    if (dto.nivel_final <= 2) {
      await this.crearAlertaCritica(
        turno.id,
        turno.hospital_id,
        dto.nivel_final,
        dto.enfermero_id,
      );
    }

    // 11. Publicar evento RabbitMQ
    await this.eventPublisher.publishTriageConfirmado({
      turno_id: turno.id,
      confirmacion_id: confirmacion.id,
      registro_triage_id: dto.registro_triage_id,
      paciente_id: turno.paciente_id,
      hospital_id: turno.hospital_id,
      enfermero_id: dto.enfermero_id,
      nivel_sugerido_ollama: registro.nivel_sugerido_ia,
      nivel_final_enfermero: dto.nivel_final,
      acepto_sugerencia,
      razon_modificacion: dto.razon_modificacion,
      posicion_cola: posicion,
    });


    // 12. WebSocket: Notificar confirmación de triage
    const usuarioPaciente = await this.prisma.usuarios.findUnique({
      where: { id: turno.pacientes.usuario_id },
    });

    this.triageGateway.emitTriageConfirmado(
      {
        turno_id: turno.id,
        paciente_nombre: usuarioPaciente?.nombre || 'Desconocido',
        paciente_apellido: usuarioPaciente?.apellido || '',
        nivel_triage: dto.nivel_final,
        nombre_nivel: nivelTriage.nombre,
        color: nivelTriage.color_codigo,
        posicion_cola: posicion,
        tiempo_max_espera: nivelTriage.tiempo_max_espera_min,
        timestamp: new Date().toISOString(),
      },
      turno.hospital_id,
    );

    // 13. WebSocket: Notificar al paciente
    this.triageGateway.emitToPaciente(turno.id, 'triage:confirmado', {
      nivel_triage: dto.nivel_final,
      nombre_nivel: nivelTriage.nombre,
      color: nivelTriage.color_codigo,
      posicion_cola: posicion,
      tiempo_estimado_espera: nivelTriage.tiempo_max_espera_min,
      mensaje: `Su nivel de prioridad es ${nivelTriage.nombre}. Posición en cola: ${posicion}`,
    });

    return {
      confirmacion_id: confirmacion.id,
      registro_id: registro.id,
      turno_id: turno.id,
      nivel_final: dto.nivel_final,
      nombre_nivel: nivelTriage.nombre,
      posicion_cola: posicion,
      estado_turno: 'EN_ESPERA',
    };
  }

  /**
   * Crea una alerta crítica para niveles 1 y 2
   */
  private async crearAlertaCritica(
    turnoId: string,
    hospitalId: number,
    nivelTriage: number,
    enfermeroId: string,
  ) {
    const tipoAlerta = 'TRIAGE_CRITICO';

    // Primero obtener el turno para sacar paciente_id
    const turno = await this.prisma.turnos.findUnique({
      where: { id: turnoId },
      include: {
        pacientes: true,
      },
    });

    const alerta = await this.prisma.alertas_criticas.create({
      data: {
        turno_id: turnoId,
        hospital_id: hospitalId,
        nivel_triage: nivelTriage,
        tipo_alerta: tipoAlerta as any,
        creado_en: new Date(),
      },
    });

    this.logger.warn(
      `Alerta crítica creada - Tipo: ${tipoAlerta}, Turno: ${turnoId}, Nivel: ${nivelTriage}`,
    );

    // Publicar evento de alerta crítica
    await this.eventPublisher.publishAlertaCritica({
      alerta_id: alerta.id,
      turno_id: turnoId,
      hospital_id: hospitalId,
      paciente_id: turno.paciente_id, 
      nivel_triage: nivelTriage,
      tipo_alerta: tipoAlerta as any,
    });

    // WebSocket: Notificar al dashboard de médicos
    const usuarioPaciente = await this.prisma.usuarios.findUnique({
      where: { id: turno.pacientes.usuario_id },
    });


    this.triageGateway.emitAlertaCritica(
      {
        alerta_id: alerta.id,
        turno_id: turnoId,
        numero_turno: turno.numero_turno,
        paciente_nombre: usuarioPaciente?.nombre || 'Desconocido',
        nivel_triage: nivelTriage,
        tipo_alerta: tipoAlerta as any,
        timestamp: new Date().toISOString(),
      },
      hospitalId,
    );

    return alerta;
  }

  /**
   * Obtiene una confirmación por ID
   */
  async obtenerConfirmacion(id: string) {
    const confirmacion = await this.prisma.confirmaciones_enfermero.findUnique({
      where: { id },
      include: {
        registro_triage: {
          include: {
          },
        },
        enfermero: true,
      },
    });

    if (!confirmacion) {
      throw new NotFoundException(`Confirmación ${id} no encontrada`);
    }

    return confirmacion;
  }

  /**
   * Obtiene confirmaciones por enfermero
   */
  async obtenerConfirmacionesPorEnfermero(enfermeroId: string, limit: number = 50) {
    return this.prisma.confirmaciones_enfermero.findMany({
      where: { enfermero_id: enfermeroId },
      include: {
        registro_triage: {
          include: {
          },
        },
      },
      orderBy: { creado_en: 'desc' },
      take: limit,
    });
  }

  /**
   * Obtiene el estado actual del triage de un turno
   */
  async obtenerEstadoTriage(turnoId: string) {
    const turno = await this.prisma.turnos.findUnique({
      where: { id: turnoId },
      include: {
        registro_triage: {
          include: {
          },
        },
      },
    });

    if (!turno) {
      throw new NotFoundException(`Turno ${turnoId} no encontrado`);
    }

    // Obtener nivel de triage
    const nivelTriage = turno.nivel_triage_id
      ? await this.prisma.niveles_triage.findUnique({
          where: { id: turno.nivel_triage_id },
        })
      : null;

    let posicionCola = null;
    if (turno.nivel_triage_id && turno.estado === 'EN_ESPERA') {
      posicionCola = await this.colaService.obtenerPosicionEnCola(
        turnoId,
        turno.hospital_id,
        turno.nivel_triage_id,
      );
    }

    return {
      turno_id: turno.id,
      numero_turno: turno.numero_turno,
      estado: turno.estado,
      nivel_triage: turno.nivel_triage_id,
      nombre_nivel: nivelTriage?.nombre,
      posicion_cola: posicionCola,
      registro_triage: turno.registro_triage,
    };
  }
}