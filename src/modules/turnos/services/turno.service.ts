// src/modules/turnos/services/turno.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { CrearTurnoUrgenciaDto } from '../dto/crear-turno-urgencia.dto';
import { ActualizarEstadoTurnoDto } from '../dto/actualizar-estado-turno.dto';
import { LlamarPacienteDto } from '../dto/llamar-paciente.dto';
import { FinalizarTurnoDto } from '../dto/finalizar-turno.dto';
import { GeneradorNumeroService } from './generador-numero.service';
import { TipoTurno, EstadoTurno, Turno } from '../entities/turno.entity';
import { ColaService } from '@/modules/cola/services/cola.service';
import { TriageGateway } from '@/modules/websockets/gateways/triage.gateway';
import { TriageEventPublisher } from '@/modules/eventos/publishers/triage-event.publisher';
import { CoreClientService } from '@/modules/core-client/core-client.service';
import { CoreNotifierService } from '@/modules/core-client/core-notifier.service';

@Injectable()
export class TurnoService {
  private readonly logger = new Logger(TurnoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generadorNumero: GeneradorNumeroService,
    private readonly colaService: ColaService,
    @Inject(TriageGateway)
    private readonly triageGateway: TriageGateway,
    private readonly eventPublisher: TriageEventPublisher,
    private readonly coreClient: CoreClientService,
    private readonly coreNotifier: CoreNotifierService,
  ) {}

  async crearTurnoUrgencia(dto: CrearTurnoUrgenciaDto): Promise<Turno> {
    await this.coreClient.sincronizarPaciente(dto.paciente_id);

    const paciente = await this.prisma.pacientes.findUnique({
      where: { id: dto.paciente_id },
    });

    if (!paciente) {
      throw new NotFoundException('Paciente no encontrado');
    }

    const hospital = await this.prisma.hospitales.findUnique({
      where: { id: dto.hospital_id },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital no encontrado');
    }

    const numeroTurno = await this.generadorNumero.generarNumeroTurno(
      dto.hospital_id,
      TipoTurno.URGENCIA,
    );

    const turno = await this.prisma.turnos.create({
      data: {
        hospital_id: dto.hospital_id,
        paciente_id: dto.paciente_id,
        tipo_turno: TipoTurno.URGENCIA,
        numero_turno: numeroTurno,
        estado: EstadoTurno.CLASIFICACION_PENDIENTE,
        fecha: new Date(),
      },
      include: {
        pacientes: true,
        hospitales: true,
      },
    });

    const usuario = await this.prisma.usuarios.findUnique({
      where: { id: paciente.usuario_id },
    });

    this.logger.log(
      `Turno creado: ${turno.id} - Número: ${numeroTurno} - Hospital: ${hospital.nombre}`,
    );

    this.triageGateway.emitTurnoCreado({
      turno_id: turno.id,
      numero_turno: numeroTurno,
      hospital_id: dto.hospital_id,
      paciente_nombre: usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Desconocido',
      estado: EstadoTurno.CLASIFICACION_PENDIENTE,
      timestamp: new Date().toISOString(),
    });

    await this.eventPublisher.publishTurnoCreado({
      turno_id: turno.id,
      numero_turno: numeroTurno,
      hospital_id: dto.hospital_id,
      paciente_id: dto.paciente_id,
      tipo_turno: TipoTurno.URGENCIA,
      estado: EstadoTurno.CLASIFICACION_PENDIENTE,
      fecha: new Date().toISOString(),
    });

    await this.coreNotifier.notificarTurnoCreado({
      turno_id: turno.id,
      numero_turno: numeroTurno,
      hospital_id: dto.hospital_id,
      paciente_id: dto.paciente_id,
      tipo_turno: TipoTurno.URGENCIA,
      estado: EstadoTurno.CLASIFICACION_PENDIENTE,
      fecha: new Date().toISOString(),
    });

    return turno as unknown as Turno;
  }

  async obtenerPorId(id: string): Promise<Turno> {
    const turno = await this.prisma.turnos.findUnique({
      where: { id },
      include: {
        pacientes: true,
        hospitales: true,
        nivel_triage: true,
      },
    });

    if (!turno) {
      throw new NotFoundException('Turno no encontrado');
    }

    return turno as unknown as Turno;
  }

  async obtenerPorHospital(
    hospitalId: number,
    fecha?: Date,
    estado?: EstadoTurno,
  ): Promise<Turno[]> {
    const turnos = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        tipo_turno: TipoTurno.URGENCIA,
        ...(fecha && {
          fecha: {
            gte: new Date(fecha.setHours(0, 0, 0, 0)),
            lt: new Date(fecha.setHours(23, 59, 59, 999)),
          },
        }),
        ...(estado && { estado }),
      },
      include: {
        pacientes: true,
        nivel_triage: true,
        registro_triage: true,
      },
      orderBy: [{ nivel_triage_id: 'asc' }, { creado_en: 'asc' }],
    });

    return turnos as unknown as Turno[];
  }

  async actualizarEstado(id: string, dto: ActualizarEstadoTurnoDto): Promise<Turno> {
    const turno = await this.obtenerPorId(id);

    const turnoActualizado = await this.prisma.turnos.update({
      where: { id },
      data: {
        estado: dto.estado,
      },
      include: {
        pacientes: true,
        nivel_triage: true,
      },
    });

    this.logger.log(`Estado actualizado: Turno ${id} - ${turno.estado} → ${dto.estado}`);

    return turnoActualizado as unknown as Turno;
  }

  async llamarPaciente(id: string, dto: LlamarPacienteDto): Promise<Turno> {
    const turno = await this.obtenerPorId(id);

    if (turno.estado !== EstadoTurno.EN_ESPERA) {
      throw new BadRequestException(
        `El turno debe estar en estado EN_ESPERA. Estado actual: ${turno.estado}`,
      );
    }

    // dto.medico_id es el usuarios.id que viene del JWT del médico autenticado
    await this.coreClient.sincronizarMedico(dto.medico_id);

    // Buscar por usuario_id DESPUÉS de sincronizar (la sincronización lo crea si no existe)
    const medico = await this.prisma.medicos.findFirst({
      where: { usuario_id: dto.medico_id },
    });

    this.logger.debug(`[llamarPaciente] Buscando médico con usuario_id: ${dto.medico_id}`);
    this.logger.debug(`[llamarPaciente] Médico encontrado: ${JSON.stringify(medico)}`);

    if (!medico) {
      throw new NotFoundException(
        `Médico con usuario_id ${dto.medico_id} no encontrado en triage`,
      );
    }

    this.logger.log(`[llamarPaciente] Médico encontrado con id: ${medico.id}`);

    if (turno.nivel_triage_id) {
      await this.colaService.removerDeCola(id, turno.hospital_id, turno.nivel_triage_id);
      this.logger.log(`Turno removido de cola Redis`);
    }

    // Usar medico.id (PK de la tabla medicos del triage), NO el usuario_id
    const turnoActualizado = await this.prisma.turnos.update({
      where: { id },
      data: {
        estado: EstadoTurno.EN_CONSULTA,
        medico_id: medico.id,   // <-- CORREGIDO: PK de medicos
        llamado_en: new Date(),
      },
      include: {
        pacientes: true,
        nivel_triage: true,
      },
    });

    this.logger.log(`Paciente llamado: Turno ${turno.numero_turno} - Consultorio: ${dto.consultorio}`);

    const medicoUsuario = await this.prisma.usuarios.findUnique({
      where: { id: medico.usuario_id },
    });

    const paciente = await this.prisma.pacientes.findUnique({
      where: { id: turno.paciente_id },
    });

    const pacienteUsuario = paciente
      ? await this.prisma.usuarios.findUnique({ where: { id: paciente.usuario_id } })
      : null;

    this.triageGateway.emitPacienteLlamado(
      {
        turno_id: turno.id,
        numero_turno: turno.numero_turno,
        paciente_nombre: pacienteUsuario?.nombre || 'Desconocido',
        paciente_apellido: pacienteUsuario?.apellido || '',
        consultorio: dto.consultorio,
        medico_nombre: medicoUsuario
          ? `${medicoUsuario.nombre} ${medicoUsuario.apellido}`
          : 'Desconocido',
        nivel_triage: turno.nivel_triage_id,
        timestamp: new Date().toISOString(),
      },
      turno.hospital_id,
    );

    const tiempoEsperaMs = Date.now() - turno.creado_en.getTime();
    const tiempoEsperaMin = Math.floor(tiempoEsperaMs / 60000);

    await this.eventPublisher.publishPacienteLlamado({
      turno_id: turno.id,
      numero_turno: turno.numero_turno,
      hospital_id: turno.hospital_id,
      paciente_id: turno.paciente_id,
      medico_id: dto.medico_id,  // se mantiene el usuario_id para que M1 lo procese
      consultorio: dto.consultorio,
      nivel_triage: turno.nivel_triage_id || 0,
      tiempo_espera_minutos: tiempoEsperaMin,
    });

    return turnoActualizado as unknown as Turno;
  }

  async finalizarTurno(id: string, dto: FinalizarTurnoDto): Promise<Turno> {
    const turno = await this.obtenerPorId(id);
    if (turno.estado !== EstadoTurno.EN_CONSULTA) {
      throw new BadRequestException(
        `El turno debe estar en estado EN_CONSULTA. Estado actual: ${turno.estado}`,
      );
    }

    const tiempoEsperaMs = (turno.llamado_en || new Date()).getTime() - turno.creado_en.getTime();
    const tiempoEsperaMin = Math.floor(tiempoEsperaMs / 60000);

    const tiempoAtencionMs = Date.now() - (turno.llamado_en || new Date()).getTime();
    const tiempoAtencionMin = Math.floor(tiempoAtencionMs / 60000);

    const turnoActualizado = await this.prisma.turnos.update({
      where: { id },
      data: {
        estado: EstadoTurno.ATENDIDO,
        atendido_en: turno.llamado_en || new Date(),
        finalizado_en: new Date(),
      },
    });

    // ─── BLOQUE: guardar consulta de urgencia ─────────────────────────────
    // Usamos turno.medico_id (ya sincronizado en llamarPaciente) para la FK,
    // en lugar de dto.medico_id que puede ser un ID diferente (ej. usuario_id).
    try {
      const turnoCompleto = await this.prisma.turnos.findUnique({
        where: { id },
        select: { registro_triage_id: true, medico_id: true },
      });

      const medicoIdParaConsulta = turnoCompleto?.medico_id ?? null;

      if (!medicoIdParaConsulta) {
        this.logger.warn(`Turno ${id} no tiene medico_id; omitiendo consulta de urgencia`);
      } else {
        await this.prisma.consultas_urgencia.create({
          data: {
            turno_id: turno.id,
            paciente_id: turno.paciente_id,
            medico_id: turno.medico_id,        // ya es el medicos.id correcto
            hospital_id: turno.hospital_id,
            diagnostico: dto.diagnostico,
            tratamiento: dto.tratamiento,
            observaciones: dto.observaciones ?? null,
            nivel_triage: turno.nivel_triage_id ?? 0,
            fecha_atencion: new Date(),
          },
        });
        this.logger.log(`Consulta de urgencia registrada para turno ${id}`);
      }
    } catch (err) {
      this.logger.error(`No se pudo guardar consulta de urgencia: ${err.message}`);
    }
    // ──────────────────────────────────────────────────────────────────────

    await this.eventPublisher.publishPacienteAtendido({
      turno_id: turno.id,
      numero_turno: turno.numero_turno,
      hospital_id: turno.hospital_id,
      paciente_id: turno.paciente_id,
      medico_id: dto.medico_id,
      nivel_triage: turno.nivel_triage_id || 0,
      tiempo_espera_minutos: tiempoEsperaMin,
      tiempo_atencion_minutos: tiempoAtencionMin,
      diagnostico: dto.diagnostico,
      tratamiento: dto.tratamiento,
      observaciones: dto.observaciones,
    });
    await this.coreNotifier.notificarPacienteAtendido({
      turno_id: turno.id,
      numero_turno: turno.numero_turno,
      hospital_id: turno.hospital_id,
      paciente_id: turno.paciente_id,
      medico_id: dto.medico_id,
      nivel_triage: turno.nivel_triage_id || 0,
      tiempo_espera_minutos: tiempoEsperaMin,
      tiempo_atencion_minutos: tiempoAtencionMin,
      diagnostico: dto.diagnostico,
      tratamiento: dto.tratamiento,
      observaciones: dto.observaciones,
    });

    this.logger.log(`Turno finalizado: ${id}`);

    return turnoActualizado as unknown as Turno;
  }

  async cancelarTurno(id: string): Promise<Turno> {
    const turno = await this.obtenerPorId(id);

    const turnoActualizado = await this.prisma.turnos.update({
      where: { id },
      data: {
        estado: EstadoTurno.CANCELADO,
      },
    });

    await this.eventPublisher.publishTurnoCancelado({
      turno_id: turno.id,
      hospital_id: turno.hospital_id,
      razon: 'Cancelado por administración',
    });
    await this.coreNotifier.notificarTurnoCancelado({
      turno_id: turno.id,
      hospital_id: turno.hospital_id,
      paciente_id: turno.paciente_id,
      numero_turno: turno.numero_turno,
      razon: 'Cancelado por administración',
    });

    this.logger.log(`Turno cancelado (admin): ${id}`);

    return turnoActualizado as unknown as Turno;
  }

  async cancelarTurnoPorPaciente(id: string): Promise<Turno> {
    const turno = await this.obtenerPorId(id);

    const estadosCancelables = [
      EstadoTurno.CLASIFICACION_PENDIENTE,
      EstadoTurno.ESPERANDO_CONFIRMACION,
      EstadoTurno.EN_ESPERA,
    ];

    if (!estadosCancelables.includes(turno.estado as EstadoTurno)) {
      throw new BadRequestException(
        `No se puede cancelar un turno en estado ${turno.estado}. Solo se pueden cancelar turnos en espera o clasificación.`,
      );
    }

    const turnoActualizado = await this.prisma.turnos.update({
      where: { id },
      data: {
        estado: EstadoTurno.CANCELADO,
      },
    });

    await this.eventPublisher.publishTurnoCancelado({
      turno_id: turno.id,
      hospital_id: turno.hospital_id,
      razon: 'Cancelado por el paciente',
    });
    await this.coreNotifier.notificarTurnoCancelado({
      turno_id: turno.id,
      hospital_id: turno.hospital_id,
      paciente_id: turno.paciente_id,
      numero_turno: turno.numero_turno,
      razon: 'Cancelado por el paciente',
    });

    this.logger.log(`Turno cancelado (paciente): ${id}`);

    return turnoActualizado as unknown as Turno;
  }
}