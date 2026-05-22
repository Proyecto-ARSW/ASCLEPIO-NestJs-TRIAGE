import { Test, TestingModule } from '@nestjs/testing';
import { EscalamientoService } from './escalamiento.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertaCriticaService } from './alerta-critica.service';
import { TriageEventPublisher } from '../../eventos/publishers/triage-event.publisher';
import { TriageGateway } from '../../websockets/gateways/triage.gateway';
import { EscalarAlertaDto } from '../dto/escalar-alerta.dto';

import { Logger } from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
});

describe('EscalamientoService', () => {
  let service: EscalamientoService;

  const ALERTA_ID = 'alerta-uuid-1234';
  const JEFE_GUARDIA_ID = 'jefe-uuid-1234';
  const HOSPITAL_ID = 1;

  const mockAlerta = {
    id: ALERTA_ID,
    turno_id: 'turno-1',
    hospital_id: HOSPITAL_ID,
    nivel_triage: 2,
    escalada: false,
    creado_en: new Date(Date.now() - 5 * 60000), // 5 min atrás
  };

  const mockPrisma = {
    turnos: { findUnique: jest.fn() },
    alertas_criticas: { update: jest.fn() },
    usuarios: { findUnique: jest.fn(), findFirst: jest.fn() },
    medicos: { findFirst: jest.fn() },
  };

  const mockAlertaCriticaService = {
    obtenerPorId: jest.fn(),
    obtenerAlertasPendientesEscalamiento: jest.fn(),
  };

  const mockEventPublisher = {
    publishAlertaEscalada: jest.fn().mockResolvedValue(undefined),
  };

  const mockTriageGateway = {
    emitNotificacion: jest.fn(),
    emitToDashboardMedicos: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalamientoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AlertaCriticaService, useValue: mockAlertaCriticaService },
        { provide: TriageEventPublisher, useValue: mockEventPublisher },
        { provide: TriageGateway, useValue: mockTriageGateway },
      ],
    }).compile();

    service = module.get<EscalamientoService>(EscalamientoService);
    jest.clearAllMocks();
  });

  describe('escalarAlerta', () => {
    const dto: EscalarAlertaDto = {
      alerta_id: ALERTA_ID,
      jefe_guardia_id: JEFE_GUARDIA_ID,
      razon_escalamiento: 'No atendida en tiempo',
    };

    it('debería escalar una alerta no escalada', async () => {
      const alertaEscalada = { ...mockAlerta, escalada: true, tipo_alerta: 'TRIAGE_ESCALADO' };
      mockAlertaCriticaService.obtenerPorId.mockResolvedValue(mockAlerta);
      mockPrisma.turnos.findUnique.mockResolvedValue({
        id: 'turno-1',
        numero_turno: 1,
        pacientes: { usuario_id: 'usuario-pac-1' },
      });
      mockPrisma.alertas_criticas.update.mockResolvedValue(alertaEscalada);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Ana', apellido: 'Gómez' });

      const result = await service.escalarAlerta(dto);

      expect(result.escalada).toBe(true);
      expect(result.tipo_alerta).toBe('TRIAGE_ESCALADO');
      expect(mockPrisma.alertas_criticas.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ escalada: true }) }),
      );
      expect(mockEventPublisher.publishAlertaEscalada).toHaveBeenCalled();
      expect(mockTriageGateway.emitNotificacion).toHaveBeenCalled();
    });

    it('debería retornar la alerta sin escalar si ya estaba escalada', async () => {
      const alertaYaEscalada = { ...mockAlerta, escalada: true };
      mockAlertaCriticaService.obtenerPorId.mockResolvedValue(alertaYaEscalada);

      const result = await service.escalarAlerta(dto);

      expect(result.escalada).toBe(true);
      expect(mockPrisma.alertas_criticas.update).not.toHaveBeenCalled();
    });
  });

  describe('procesarEscalamientoAutomatico', () => {
    it('debería retornar 0 si no hay alertas pendientes', async () => {
      mockAlertaCriticaService.obtenerAlertasPendientesEscalamiento.mockResolvedValue([]);

      const result = await service.procesarEscalamientoAutomatico();

      expect(result).toBe(0);
    });

    it('debería escalar alertas pendientes y retornar el conteo', async () => {
      const alertasPendientes = [mockAlerta];
      mockAlertaCriticaService.obtenerAlertasPendientesEscalamiento.mockResolvedValue(alertasPendientes);
      mockPrisma.medicos.findFirst.mockResolvedValue(null);
      mockPrisma.usuarios.findFirst.mockResolvedValue({ id: JEFE_GUARDIA_ID });
      // Para escalarAlerta interna:
      mockAlertaCriticaService.obtenerPorId.mockResolvedValue(mockAlerta);
      mockPrisma.turnos.findUnique.mockResolvedValue({
        id: 'turno-1',
        numero_turno: 1,
        pacientes: { usuario_id: 'user-1' },
      });
      mockPrisma.alertas_criticas.update.mockResolvedValue({ ...mockAlerta, escalada: true });
      mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Juan', apellido: 'Jefe' });

      const result = await service.procesarEscalamientoAutomatico();

      expect(result).toBe(1);
    });

    it('debería continuar si falla el escalamiento de una alerta individual', async () => {
      const alertas = [mockAlerta, { ...mockAlerta, id: 'alerta-2' }];
      mockAlertaCriticaService.obtenerAlertasPendientesEscalamiento.mockResolvedValue(alertas);
      mockPrisma.medicos.findFirst.mockResolvedValue(null);
      mockPrisma.usuarios.findFirst.mockResolvedValue({ id: JEFE_GUARDIA_ID });
      mockAlertaCriticaService.obtenerPorId
        .mockRejectedValueOnce(new Error('Error al procesar'))
        .mockResolvedValue(mockAlerta);
      mockPrisma.turnos.findUnique.mockResolvedValue({
        id: 'turno-1',
        numero_turno: 1,
        pacientes: { usuario_id: 'user-1' },
      });
      mockPrisma.alertas_criticas.update.mockResolvedValue({ ...mockAlerta, escalada: true });
      mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Juan', apellido: 'Jefe' });

      const result = await service.procesarEscalamientoAutomatico();

      expect(result).toBe(1);
    });
  });
});