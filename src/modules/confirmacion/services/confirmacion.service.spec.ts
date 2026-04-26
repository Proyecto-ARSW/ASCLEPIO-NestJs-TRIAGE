import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfirmacionService } from './confirmacion.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ColaService } from '../../cola/services/cola.service';
import { TriageEventPublisher } from '../../eventos/publishers/triage-event.publisher';
import { TriageGateway } from '../../websockets/gateways/triage.gateway';

describe('ConfirmacionService', () => {
  let service: ConfirmacionService;

  const REGISTRO_ID = 'registro-uuid-1234';
  const ENFERMERO_ID = 'enfermero-uuid-1234';
  const TURNO_ID = 'turno-uuid-1234';
  const HOSPITAL_ID = 1;

  const mockRegistro = {
    id: REGISTRO_ID,
    nivel_sugerido_ia: 3,
    nivel_preliminar_isisvoice: 3,
  };

  const mockTurno = {
    id: TURNO_ID,
    hospital_id: HOSPITAL_ID,
    paciente_id: 'pac-1',
    numero_turno: 5,
    estado: 'ESPERANDO_CONFIRMACION',
    pacientes: { usuario_id: 'usuario-pac-1' },
  };

  const mockEnfermero = { id: ENFERMERO_ID, usuario_id: 'usuario-enf-1', activo: true };
  const mockNivelTriage = { id: 3, nombre: 'Amarillo', color_codigo: '#FFFF00', tiempo_max_espera_min: 60 };

  const mockPrisma = {
    registros_triage: { findUnique: jest.fn(), update: jest.fn() },
    turnos: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    enfermeros: { findUnique: jest.fn() },
    niveles_triage: { findUnique: jest.fn() },
    confirmaciones_enfermero: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    alertas_criticas: { create: jest.fn() },
    usuarios: { findUnique: jest.fn() },
  };

  const mockCola = { agregarACola: jest.fn().mockResolvedValue(3) };
  const mockEventPublisher = {
    publishTriageConfirmado: jest.fn().mockResolvedValue(undefined),
    publishAlertaCritica: jest.fn().mockResolvedValue(undefined),
  };
  const mockTriageGateway = {
    emitTriageConfirmado: jest.fn(),
    emitToPaciente: jest.fn(),
    emitAlertaCritica: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmacionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ColaService, useValue: mockCola },
        { provide: TriageEventPublisher, useValue: mockEventPublisher },
        { provide: TriageGateway, useValue: mockTriageGateway },
      ],
    }).compile();

    service = module.get<ConfirmacionService>(ConfirmacionService);
    jest.clearAllMocks();
  });

  function setupHappyPath(nivelFinal: number = 3) {
    mockPrisma.registros_triage.findUnique.mockResolvedValue(mockRegistro);
    mockPrisma.turnos.findFirst.mockResolvedValue(mockTurno);
    mockPrisma.enfermeros.findUnique.mockResolvedValue(mockEnfermero);
    mockPrisma.niveles_triage.findUnique.mockResolvedValue({ ...mockNivelTriage, id: nivelFinal });
    mockPrisma.confirmaciones_enfermero.create.mockResolvedValue({
      id: 'conf-1',
      nivel_sugerido_ia: 3,
      nivel_final_enfermero: nivelFinal,
    });
    mockPrisma.registros_triage.update.mockResolvedValue({});
    mockPrisma.turnos.update.mockResolvedValue({});
    mockCola.agregarACola.mockResolvedValue(3);
    mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'María', apellido: 'García' });
  }

  describe('confirmarTriage', () => {
    const dto = {
      registro_triage_id: REGISTRO_ID,
      enfermero_id: ENFERMERO_ID,
      nivel_final: 3,
    };

    it('debería confirmar el triage cuando el enfermero acepta la sugerencia de IA', async () => {
      setupHappyPath(3);

      const result = await service.confirmarTriage(dto);

      expect(result.nivel_final).toBe(3);
      expect(result.estado_turno).toBe('EN_ESPERA');
      expect(result.posicion_cola).toBe(3);
      expect(mockPrisma.confirmaciones_enfermero.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acepto_sugerencia: true, tipo_modificacion: null }),
        }),
      );
    });

    it('debería registrar ESCALAMIENTO cuando el enfermero sube la prioridad (nivel menor)', async () => {
      const dtoEscalado = { ...dto, nivel_final: 1 };
      setupHappyPath(1);

      const result = await service.confirmarTriage(dtoEscalado);

      expect(result.nivel_final).toBe(1);
      expect(mockPrisma.confirmaciones_enfermero.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acepto_sugerencia: false, tipo_modificacion: 'ESCALAMIENTO' }),
        }),
      );
    });

    it('debería registrar DEGRADACION cuando el enfermero baja la prioridad (nivel mayor)', async () => {
      const dtoDegradado = { ...dto, nivel_final: 5 };
      setupHappyPath(5);

      const result = await service.confirmarTriage(dtoDegradado);

      expect(result.nivel_final).toBe(5);
      expect(mockPrisma.confirmaciones_enfermero.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acepto_sugerencia: false, tipo_modificacion: 'DEGRADACION' }),
        }),
      );
    });

    it('debería agregar al paciente a la cola de espera', async () => {
      setupHappyPath(3);

      await service.confirmarTriage(dto);

      expect(mockCola.agregarACola).toHaveBeenCalledWith(TURNO_ID, HOSPITAL_ID, 3);
    });

    it('debería actualizar estado del turno a EN_ESPERA', async () => {
      setupHappyPath(3);

      await service.confirmarTriage(dto);

      expect(mockPrisma.turnos.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'EN_ESPERA', nivel_triage_id: 3 }) }),
      );
    });

    it('debería emitir WebSocket de triage confirmado', async () => {
      setupHappyPath(3);

      await service.confirmarTriage(dto);

      expect(mockTriageGateway.emitTriageConfirmado).toHaveBeenCalled();
      expect(mockTriageGateway.emitToPaciente).toHaveBeenCalledWith(
        TURNO_ID,
        'triage:confirmado',
        expect.any(Object),
      );
    });

    it('debería crear alerta crítica para nivel 1', async () => {
      const dtoNivel1 = { ...dto, nivel_final: 1 };
      setupHappyPath(1);
      mockPrisma.turnos.findUnique.mockResolvedValue({ ...mockTurno, pacientes: { usuario_id: 'user-pac' } });
      mockPrisma.alertas_criticas.create.mockResolvedValue({ id: 'alerta-critica-1' });

      await service.confirmarTriage(dtoNivel1);

      expect(mockPrisma.alertas_criticas.create).toHaveBeenCalled();
      expect(mockTriageGateway.emitAlertaCritica).toHaveBeenCalled();
    });

    it('debería crear alerta crítica para nivel 2', async () => {
      const dtoNivel2 = { ...dto, nivel_final: 2 };
      setupHappyPath(2);
      mockPrisma.turnos.findUnique.mockResolvedValue({ ...mockTurno, pacientes: { usuario_id: 'user-pac' } });
      mockPrisma.alertas_criticas.create.mockResolvedValue({ id: 'alerta-critica-2' });

      await service.confirmarTriage(dtoNivel2);

      expect(mockPrisma.alertas_criticas.create).toHaveBeenCalled();
    });

    it('NO debería crear alerta crítica para nivel 3 o mayor', async () => {
      setupHappyPath(3);

      await service.confirmarTriage(dto);

      expect(mockPrisma.alertas_criticas.create).not.toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si el registro no existe', async () => {
      mockPrisma.registros_triage.findUnique.mockResolvedValue(null);

      await expect(service.confirmarTriage(dto)).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar NotFoundException si no hay turno asociado al registro', async () => {
      mockPrisma.registros_triage.findUnique.mockResolvedValue(mockRegistro);
      mockPrisma.turnos.findFirst.mockResolvedValue(null);

      await expect(service.confirmarTriage(dto)).rejects.toThrow(NotFoundException);
      await expect(service.confirmarTriage(dto)).rejects.toThrow('turno asociado');
    });

    it('debería lanzar NotFoundException si el enfermero no existe', async () => {
      mockPrisma.registros_triage.findUnique.mockResolvedValue(mockRegistro);
      mockPrisma.turnos.findFirst.mockResolvedValue(mockTurno);
      mockPrisma.enfermeros.findUnique.mockResolvedValue(null);

      await expect(service.confirmarTriage(dto)).rejects.toThrow(NotFoundException);
      await expect(service.confirmarTriage(dto)).rejects.toThrow('Enfermero');
    });

    it('debería lanzar BadRequestException si el nivel de triage no es válido', async () => {
      mockPrisma.registros_triage.findUnique.mockResolvedValue(mockRegistro);
      mockPrisma.turnos.findFirst.mockResolvedValue(mockTurno);
      mockPrisma.enfermeros.findUnique.mockResolvedValue(mockEnfermero);
      mockPrisma.niveles_triage.findUnique.mockResolvedValue(null);

      await expect(service.confirmarTriage(dto)).rejects.toThrow(BadRequestException);
    });

    it('debería publicar evento RabbitMQ de triage confirmado', async () => {
      setupHappyPath(3);

      await service.confirmarTriage(dto);

      expect(mockEventPublisher.publishTriageConfirmado).toHaveBeenCalledWith(
        expect.objectContaining({
          turno_id: TURNO_ID,
          registro_triage_id: REGISTRO_ID,
          enfermero_id: ENFERMERO_ID,
          nivel_final_enfermero: 3,
        }),
      );
    });
  });

  describe('obtenerConfirmacion', () => {
    it('debería retornar la confirmación si existe', async () => {
      const confirmacion = { id: 'conf-1', registro_triage_id: REGISTRO_ID };
      mockPrisma.confirmaciones_enfermero.findUnique.mockResolvedValue(confirmacion);

      const result = await service.obtenerConfirmacion('conf-1');

      expect(result).toEqual(confirmacion);
    });

    it('debería lanzar NotFoundException si la confirmación no existe', async () => {
      mockPrisma.confirmaciones_enfermero.findUnique.mockResolvedValue(null);

      await expect(service.obtenerConfirmacion('id-inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('obtenerConfirmacionesPorEnfermero', () => {
    it('debería retornar las últimas confirmaciones del enfermero', async () => {
      const confirmaciones = [{ id: 'c1' }, { id: 'c2' }];
      mockPrisma.confirmaciones_enfermero.findMany.mockResolvedValue(confirmaciones);

      const result = await service.obtenerConfirmacionesPorEnfermero(ENFERMERO_ID, 50);

      expect(result).toHaveLength(2);
      expect(mockPrisma.confirmaciones_enfermero.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { enfermero_id: ENFERMERO_ID }, take: 50 }),
      );
    });
  });
});