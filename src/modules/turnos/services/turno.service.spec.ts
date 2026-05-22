import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TurnoService } from './turno.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneradorNumeroService } from './generador-numero.service';
import { ColaService } from '../../cola/services/cola.service';
import { TriageGateway } from '../../websockets/gateways/triage.gateway';
import { TriageEventPublisher } from '../../eventos/publishers/triage-event.publisher';
import { CoreClientService } from '../../core-client/core-client.service';
import { CoreNotifierService } from '../../core-client/core-notifier.service';
import { EstadoTurno, TipoTurno } from '../entities/turno.entity';
import { CrearTurnoUrgenciaDto } from '../dto/crear-turno-urgencia.dto';
import { LlamarPacienteDto } from '../dto/llamar-paciente.dto';
import { FinalizarTurnoDto } from '../dto/finalizar-turno.dto';

describe('TurnoService', () => {
  let service: TurnoService;

  const TURNO_ID = 'turno-uuid-1234';
  const PACIENTE_ID = 'paciente-uuid-1234';
  const HOSPITAL_ID = 1;
  const MEDICO_USUARIO_ID = 'medico-usuario-uuid-1234';
  const MEDICO_DB_ID = 'medico-db-uuid-5678';

  const mockTurno = {
    id: TURNO_ID,
    hospital_id: HOSPITAL_ID,
    paciente_id: PACIENTE_ID,
    numero_turno: 1,
    tipo_turno: TipoTurno.URGENCIA,
    estado: EstadoTurno.EN_ESPERA,
    nivel_triage_id: 3,
    medico_id: null,
    creado_en: new Date('2026-04-23T08:00:00'),
    llamado_en: null,
    finalizado_en: null,
    pacientes: { id: PACIENTE_ID, usuario_id: 'usuario-paciente-1' },
    hospitales: { id: HOSPITAL_ID, nombre: 'Hospital Central' },
  };

  const mockPrisma = {
    pacientes: { findUnique: jest.fn() },
    hospitales: { findUnique: jest.fn() },
    turnos: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    usuarios: { findUnique: jest.fn() },
    medicos: { findFirst: jest.fn() },
    consultas_urgencia: { create: jest.fn().mockResolvedValue({}) },
  };

  const mockGenerador = { generarNumeroTurno: jest.fn().mockResolvedValue(1) };
  const mockCola = { removerDeCola: jest.fn().mockResolvedValue(undefined) };
  const mockTriageGateway = {
    emitTurnoCreado: jest.fn(),
    emitPacienteLlamado: jest.fn(),
  };
  const mockEventPublisher = {
    publishTurnoCreado: jest.fn().mockResolvedValue(undefined),
    publishPacienteLlamado: jest.fn().mockResolvedValue(undefined),
    publishPacienteAtendido: jest.fn().mockResolvedValue(undefined),
    publishTurnoCancelado: jest.fn().mockResolvedValue(undefined),
  };
  const mockCoreClient = {
    sincronizarPaciente: jest.fn().mockResolvedValue(undefined),
    sincronizarMedico: jest.fn().mockResolvedValue(undefined),
  };
  const mockCoreNotifier = {
    notificarTurnoCreado: jest.fn().mockResolvedValue(undefined),
    notificarPacienteAtendido: jest.fn().mockResolvedValue(undefined),
    notificarTurnoCancelado: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GeneradorNumeroService, useValue: mockGenerador },
        { provide: ColaService, useValue: mockCola },
        { provide: TriageGateway, useValue: mockTriageGateway },
        { provide: TriageEventPublisher, useValue: mockEventPublisher },
        { provide: CoreClientService, useValue: mockCoreClient },
        { provide: CoreNotifierService, useValue: mockCoreNotifier },
      ],
    }).compile();

    service = module.get<TurnoService>(TurnoService);
    jest.clearAllMocks();
  });

  describe('crearTurnoUrgencia', () => {
    const dto: CrearTurnoUrgenciaDto = { paciente_id: PACIENTE_ID, hospital_id: HOSPITAL_ID };

    it('debería crear un turno de urgencia correctamente', async () => {
      mockCoreClient.sincronizarPaciente.mockResolvedValue(undefined);
      mockPrisma.pacientes.findUnique.mockResolvedValue({ id: PACIENTE_ID, usuario_id: 'user-1' });
      mockPrisma.hospitales.findUnique.mockResolvedValue({ id: HOSPITAL_ID, nombre: 'Hospital Central' });
      mockGenerador.generarNumeroTurno.mockResolvedValue(5);
      mockPrisma.turnos.create.mockResolvedValue(mockTurno);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: 'user-1', nombre: 'Juan', apellido: 'Pérez' });

      const result = await service.crearTurnoUrgencia(dto);

      expect(result).toEqual(mockTurno);
      expect(mockPrisma.turnos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hospital_id: HOSPITAL_ID,
            paciente_id: PACIENTE_ID,
            tipo_turno: TipoTurno.URGENCIA,
            estado: EstadoTurno.CLASIFICACION_PENDIENTE,
          }),
        }),
      );
      expect(mockTriageGateway.emitTurnoCreado).toHaveBeenCalled();
      expect(mockEventPublisher.publishTurnoCreado).toHaveBeenCalled();
      expect(mockCoreNotifier.notificarTurnoCreado).toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si el paciente no existe', async () => {
      mockCoreClient.sincronizarPaciente.mockResolvedValue(undefined);
      mockPrisma.pacientes.findUnique.mockResolvedValue(null);

      await expect(service.crearTurnoUrgencia(dto)).rejects.toThrow(NotFoundException);
      await expect(service.crearTurnoUrgencia(dto)).rejects.toThrow('Paciente no encontrado');
    });

    it('debería lanzar NotFoundException si el hospital no existe', async () => {
      mockCoreClient.sincronizarPaciente.mockResolvedValue(undefined);
      mockPrisma.pacientes.findUnique.mockResolvedValue({ id: PACIENTE_ID, usuario_id: 'user-1' });
      mockPrisma.hospitales.findUnique.mockResolvedValue(null);

      await expect(service.crearTurnoUrgencia(dto)).rejects.toThrow(NotFoundException);
      await expect(service.crearTurnoUrgencia(dto)).rejects.toThrow('Hospital no encontrado');
    });
  });

  describe('obtenerPorId', () => {
    it('debería retornar el turno si existe', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(mockTurno);

      const result = await service.obtenerPorId(TURNO_ID);

      expect(result).toEqual(mockTurno);
      expect(mockPrisma.turnos.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TURNO_ID } }),
      );
    });

    it('debería lanzar NotFoundException si el turno no existe', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(null);

      await expect(service.obtenerPorId('id-inexistente')).rejects.toThrow(NotFoundException);
      await expect(service.obtenerPorId('id-inexistente')).rejects.toThrow('Turno no encontrado');
    });
  });

  describe('obtenerPorHospital', () => {
    it('debería retornar lista de turnos del hospital', async () => {
      const turnos = [mockTurno, { ...mockTurno, id: 'turno-2' }];
      mockPrisma.turnos.findMany.mockResolvedValue(turnos);

      const result = await service.obtenerPorHospital(HOSPITAL_ID);

      expect(result).toHaveLength(2);
      expect(mockPrisma.turnos.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ hospital_id: HOSPITAL_ID }),
        }),
      );
    });

    it('debería filtrar por estado cuando se proporciona', async () => {
      mockPrisma.turnos.findMany.mockResolvedValue([mockTurno]);

      await service.obtenerPorHospital(HOSPITAL_ID, undefined, EstadoTurno.EN_ESPERA);

      expect(mockPrisma.turnos.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: EstadoTurno.EN_ESPERA }),
        }),
      );
    });
  });

  describe('actualizarEstado', () => {
    it('debería actualizar el estado del turno', async () => {
      const turnoActualizado = { ...mockTurno, estado: EstadoTurno.EN_CONSULTA };
      mockPrisma.turnos.findUnique.mockResolvedValue(mockTurno);
      mockPrisma.turnos.update.mockResolvedValue(turnoActualizado);

      const result = await service.actualizarEstado(TURNO_ID, { estado: EstadoTurno.EN_CONSULTA });

      expect(result.estado).toBe(EstadoTurno.EN_CONSULTA);
      expect(mockPrisma.turnos.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TURNO_ID }, data: { estado: EstadoTurno.EN_CONSULTA } }),
      );
    });

    it('debería lanzar NotFoundException si el turno no existe', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(null);

      await expect(service.actualizarEstado('id-inexistente', { estado: EstadoTurno.EN_CONSULTA }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('llamarPaciente', () => {
    const dto: LlamarPacienteDto = { medico_id: MEDICO_USUARIO_ID, consultorio: 'Consultorio 3' };

    it('debería llamar al paciente exitosamente desde EN_ESPERA', async () => {
      const turnoEnEspera = { ...mockTurno, estado: EstadoTurno.EN_ESPERA };
      const turnoEnConsulta = { ...mockTurno, estado: EstadoTurno.EN_CONSULTA, medico_id: MEDICO_DB_ID };
      const mockMedico = { id: MEDICO_DB_ID, usuario_id: MEDICO_USUARIO_ID, consultorio: 'C3' };

      mockPrisma.turnos.findUnique.mockResolvedValue(turnoEnEspera);
      mockCoreClient.sincronizarMedico.mockResolvedValue(undefined);
      mockPrisma.medicos.findFirst.mockResolvedValue(mockMedico);
      mockCola.removerDeCola.mockResolvedValue(undefined);
      mockPrisma.turnos.update.mockResolvedValue(turnoEnConsulta);
      mockPrisma.usuarios.findUnique
        .mockResolvedValueOnce({ nombre: 'Dr. Carlos', apellido: 'García' }) // medicoUsuario
        .mockResolvedValueOnce(null); // pacienteUsuario (si paciente es null)
      mockPrisma.pacientes.findUnique.mockResolvedValue(null);

      const result = await service.llamarPaciente(TURNO_ID, dto);

      expect(result.estado).toBe(EstadoTurno.EN_CONSULTA);
      expect(mockCola.removerDeCola).toHaveBeenCalledWith(TURNO_ID, HOSPITAL_ID, mockTurno.nivel_triage_id);
      expect(mockPrisma.turnos.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: EstadoTurno.EN_CONSULTA, medico_id: MEDICO_DB_ID }),
        }),
      );
      expect(mockTriageGateway.emitPacienteLlamado).toHaveBeenCalled();
      expect(mockEventPublisher.publishPacienteLlamado).toHaveBeenCalled();
    });

    it('debería lanzar BadRequestException si el turno no está EN_ESPERA', async () => {
      const turnoEnConsulta = { ...mockTurno, estado: EstadoTurno.EN_CONSULTA };
      mockPrisma.turnos.findUnique.mockResolvedValue(turnoEnConsulta);

      await expect(service.llamarPaciente(TURNO_ID, dto)).rejects.toThrow(BadRequestException);
      await expect(service.llamarPaciente(TURNO_ID, dto)).rejects.toThrow('EN_ESPERA');
    });

    it('debería lanzar NotFoundException si el médico no existe en la BD del triage', async () => {
      const turnoEnEspera = { ...mockTurno, estado: EstadoTurno.EN_ESPERA };
      mockPrisma.turnos.findUnique.mockResolvedValue(turnoEnEspera);
      mockCoreClient.sincronizarMedico.mockResolvedValue(undefined);
      mockPrisma.medicos.findFirst.mockResolvedValue(null);

      await expect(service.llamarPaciente(TURNO_ID, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('finalizarTurno', () => {
    const dto: FinalizarTurnoDto = {
      medico_id: MEDICO_USUARIO_ID,
      diagnostico: 'Gripe',
      tratamiento: 'Reposo y antipiréticos',
    };

    it('debería finalizar el turno exitosamente desde EN_CONSULTA', async () => {
      const turnoEnConsulta = {
        ...mockTurno,
        estado: EstadoTurno.EN_CONSULTA,
        medico_id: MEDICO_DB_ID, // ← obligatorio: el service valida que exista
        llamado_en: new Date('2026-04-23T09:00:00'),
      };
      const turnoAtendido = { ...turnoEnConsulta, estado: EstadoTurno.ATENDIDO };

      mockPrisma.turnos.findUnique.mockResolvedValue(turnoEnConsulta);
      mockPrisma.turnos.update.mockResolvedValue(turnoAtendido);
      mockPrisma.consultas_urgencia.create.mockResolvedValue({});

      const result = await service.finalizarTurno(TURNO_ID, dto);

      expect(result.estado).toBe(EstadoTurno.ATENDIDO);
      expect(mockPrisma.consultas_urgencia.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            turno_id: TURNO_ID,
            diagnostico: dto.diagnostico,
            tratamiento: dto.tratamiento,
          }),
        }),
      );
      expect(mockEventPublisher.publishPacienteAtendido).toHaveBeenCalledWith(
        expect.objectContaining({ diagnostico: dto.diagnostico, tratamiento: dto.tratamiento }),
      );
      expect(mockCoreNotifier.notificarPacienteAtendido).toHaveBeenCalled();
    });

    it('debería lanzar BadRequestException si el turno no está EN_CONSULTA', async () => {
      const turnoEnEspera = { ...mockTurno, estado: EstadoTurno.EN_ESPERA };
      mockPrisma.turnos.findUnique.mockResolvedValue(turnoEnEspera);

      await expect(service.finalizarTurno(TURNO_ID, dto)).rejects.toThrow(BadRequestException);
      await expect(service.finalizarTurno(TURNO_ID, dto)).rejects.toThrow('EN_CONSULTA');
    });

    it('debería lanzar BadRequestException si el turno no tiene médico asignado', async () => {
      const turnoSinMedico = {
        ...mockTurno,
        estado: EstadoTurno.EN_CONSULTA,
        medico_id: null, // ← sin médico
        llamado_en: new Date(),
      };
      mockPrisma.turnos.findUnique.mockResolvedValue(turnoSinMedico);

      await expect(service.finalizarTurno(TURNO_ID, dto)).rejects.toThrow(BadRequestException);
      await expect(service.finalizarTurno(TURNO_ID, dto)).rejects.toThrow('médico asignado');
    });
  });

  describe('cancelarTurnoPorPaciente', () => {
    it('debería cancelar el turno EN_ESPERA correctamente', async () => {
      const turnoCancelado = { ...mockTurno, estado: EstadoTurno.CANCELADO };
      mockPrisma.turnos.findUnique.mockResolvedValue(mockTurno);
      mockPrisma.turnos.update.mockResolvedValue(turnoCancelado);

      const result = await service.cancelarTurnoPorPaciente(TURNO_ID);

      expect(result.estado).toBe(EstadoTurno.CANCELADO);
      expect(mockEventPublisher.publishTurnoCancelado).toHaveBeenCalledWith(
        expect.objectContaining({ turno_id: TURNO_ID }),
      );
      expect(mockCoreNotifier.notificarTurnoCancelado).toHaveBeenCalled();
    });

    it('debería cancelar el turno en estado CLASIFICACION_PENDIENTE', async () => {
      const turnoPendiente = { ...mockTurno, estado: EstadoTurno.CLASIFICACION_PENDIENTE };
      const turnoCancelado = { ...turnoPendiente, estado: EstadoTurno.CANCELADO };
      mockPrisma.turnos.findUnique.mockResolvedValue(turnoPendiente);
      mockPrisma.turnos.update.mockResolvedValue(turnoCancelado);

      const result = await service.cancelarTurnoPorPaciente(TURNO_ID);

      expect(result.estado).toBe(EstadoTurno.CANCELADO);
    });

    it('debería lanzar BadRequestException si el turno está EN_CONSULTA', async () => {
      const turnoEnConsulta = { ...mockTurno, estado: EstadoTurno.EN_CONSULTA };
      mockPrisma.turnos.findUnique.mockResolvedValue(turnoEnConsulta);

      await expect(service.cancelarTurnoPorPaciente(TURNO_ID)).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar NotFoundException si el turno no existe', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(null);

      await expect(service.cancelarTurnoPorPaciente('id-inexistente')).rejects.toThrow(NotFoundException);
    });
  });
});