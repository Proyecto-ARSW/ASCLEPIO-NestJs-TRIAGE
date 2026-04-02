// src/modules/turnos/services/turno.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CrearTurnoUrgenciaDto } from '../dto/crear-turno-urgencia.dto';
import { ActualizarEstadoTurnoDto } from '../dto/actualizar-estado-turno.dto';
import { LlamarPacienteDto } from '../dto/llamar-paciente.dto';
import { FinalizarTurnoDto } from '../dto/finalizar-turno.dto';
import { GeneradorNumeroService } from './generador-numero.service';
import { TipoTurno, EstadoTurno, Turno } from '../entities/turno.entity';

@Injectable()
export class TurnoService {
  private readonly logger = new Logger(TurnoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generadorNumero: GeneradorNumeroService,
  ) {}

  /**
   * Crea un nuevo turno de urgencia
   */
  async crearTurnoUrgencia(dto: CrearTurnoUrgenciaDto): Promise<Turno> {
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
        estado: EstadoTurno.CUESTIONARIO_PENDIENTE,
        fecha: new Date(),
      },
      include: {
        pacientes: {
          include: {
            usuarios: true,
          },
        },
        hospitales: true,
      },
    });

    this.logger.log(
      `Turno creado: ${turno.id} - Número: ${numeroTurno} - Hospital: ${hospital.nombre}`,
    );

    return turno as Turno;
  }

  /**
   * Obtiene un turno por ID
   */
  async obtenerPorId(id: string): Promise<Turno> {
    const turno = await this.prisma.turnos.findUnique({
      where: { id },
      include: {
        pacientes: {
          include: {
            usuarios: true,
          },
        },
        hospitales: true,
        nivel_triage: true,
        medicos: true,
        registro_triage: true,
      },
    });

    if (!turno) {
      throw new NotFoundException('Turno no encontrado');
    }

    return turno as Turno;
  }

  /**
   * Obtiene todos los turnos de un hospital
   */
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
        pacientes: {
          include: {
            usuarios: true,
          },
        },
        nivel_triage: true,
        registro_triage: true,
      },
      orderBy: [
        { nivel_triage_id: 'asc' },
        { creado_en: 'asc' },
      ],
    });

    return turnos as Turno[];
  }

  /**
   * Actualiza el estado de un turno
   */
  async actualizarEstado(id: string, dto: ActualizarEstadoTurnoDto): Promise<Turno> {
    const turno = await this.obtenerPorId(id);

    const turnoActualizado = await this.prisma.turnos.update({
      where: { id },
      data: {
        estado: dto.estado,
      },
      include: {
        pacientes: {
          include: {
            usuarios: true,
          },
        },
        nivel_triage: true,
      },
    });

    this.logger.log(
      `Estado actualizado: Turno ${id} - ${turno.estado} → ${dto.estado}`,
    );

    return turnoActualizado as Turno;
  }

  /**
   * Llamar paciente para atención (médico)
   */
  async llamarPaciente(id: string, dto: LlamarPacienteDto): Promise<Turno> {
    const turno = await this.obtenerPorId(id);
    if (turno.estado !== EstadoTurno.EN_ESPERA) {
      throw new BadRequestException(
        `El turno debe estar en estado EN_ESPERA. Estado actual: ${turno.estado}`,
      );
    }

    const turnoActualizado = await this.prisma.turnos.update({
      where: { id },
      data: {
        estado: EstadoTurno.EN_CONSULTA,
        medico_id: dto.medico_id,
        llamado_en: new Date(),
      },
      include: {
        pacientes: {
          include: {
            usuarios: true,
          },
        },
        nivel_triage: true,
        medicos: true,
      },
    });

    this.logger.log(
      `Paciente llamado: Turno ${turno.numero_turno} - Consultorio: ${dto.consultorio}`,
    );

    return turnoActualizado as Turno;
  }

  /**
   * Finalizar atención de turno
   */
  async finalizarTurno(id: string, dto: FinalizarTurnoDto): Promise<Turno> {
    const turno = await this.obtenerPorId(id);
    if (turno.estado !== EstadoTurno.EN_CONSULTA) {
      throw new BadRequestException(
        `El turno debe estar en estado EN_CONSULTA. Estado actual: ${turno.estado}`,
      );
    }

    const turnoActualizado = await this.prisma.turnos.update({
      where: { id },
      data: {
        estado: EstadoTurno.ATENDIDO,
        atendido_en: turno.llamado_en || new Date(),
        finalizado_en: new Date(),
      },
    });

    // Crear registro en historial médico (esto debería estar en otro módulo)
    // Por ello se deja comentado.
    /*
    await this.prisma.historial_medico.create({
      data: {
        paciente_id: turno.paciente_id,
        medico_id: dto.medico_id,
        turno_id: id,
        diagnostico: dto.diagnostico,
        tratamiento: dto.tratamiento,
        observaciones: dto.observaciones,
      },
    });
    */

    this.logger.log(`Turno finalizado: ${id}`);

    return turnoActualizado as Turno;
  }

  /**
   * Cancelar turno
   */
  async cancelarTurno(id: string): Promise<Turno> {
    const turno = await this.obtenerPorId(id);

    const turnoActualizado = await this.prisma.turnos.update({
      where: { id },
      data: {
        estado: EstadoTurno.CANCELADO,
      },
    });

    this.logger.log(`Turno cancelado: ${id}`);

    return turnoActualizado as Turno;
  }
}