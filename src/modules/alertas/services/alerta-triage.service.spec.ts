import { Test, TestingModule } from '@nestjs/testing';
import { AlertaTriageService } from './alerta-triage.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AlertaTriageService', () => {
  let service: AlertaTriageService;

  const mockPrisma = {
    alertas_triage: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertaTriageService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AlertaTriageService>(AlertaTriageService);
    jest.clearAllMocks();
  });

  describe('crearAlertaTiempoEspera', () => {
    it('debería crear una alerta de tiempo de espera excedido', async () => {
      const mockAlerta = { id: 'alerta-triage-1', tipo_alerta: 'TIEMPO_ESPERA_EXCEDIDO' };
      mockPrisma.alertas_triage.create.mockResolvedValue(mockAlerta);

      const result = await service.crearAlertaTiempoEspera('turno-1', 1, 45);

      expect(result).toEqual(mockAlerta);
      expect(mockPrisma.alertas_triage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            turno_id: 'turno-1',
            hospital_id: 1,
            tipo_alerta: 'TIEMPO_ESPERA_EXCEDIDO',
            nivel_severidad: 'ALTA',
            tiempo_excedido_minutos: 45,
            resuelta: false,
          }),
        }),
      );
    });
  });

  describe('resolverAlerta', () => {
    it('debería marcar la alerta como resuelta', async () => {
      const alertaResuelta = { id: 'alerta-1', resuelta: true };
      mockPrisma.alertas_triage.update.mockResolvedValue(alertaResuelta);

      const result = await service.resolverAlerta('alerta-1', 'usuario-1');

      expect(result.resuelta).toBe(true);
      expect(mockPrisma.alertas_triage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alerta-1' },
          data: expect.objectContaining({ resuelta: true, resuelta_por: 'usuario-1' }),
        }),
      );
    });

    it('debería resolver sin usuario asignado si no se proporciona', async () => {
      mockPrisma.alertas_triage.update.mockResolvedValue({ id: 'alerta-1', resuelta: true });

      await service.resolverAlerta('alerta-1');

      expect(mockPrisma.alertas_triage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ resuelta_por: null }) }),
      );
    });
  });

  describe('obtenerAlertasActivas', () => {
    it('debería retornar alertas activas del hospital ordenadas por tiempo excedido', async () => {
      const alertas = [
        { id: 'a1', tiempo_excedido_minutos: 60 },
        { id: 'a2', tiempo_excedido_minutos: 30 },
      ];
      mockPrisma.alertas_triage.findMany.mockResolvedValue(alertas);

      const result = await service.obtenerAlertasActivas(1);

      expect(result).toHaveLength(2);
      expect(mockPrisma.alertas_triage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hospital_id: 1, resuelta: false } }),
      );
    });
  });

  describe('resolverAlertasPorTurno', () => {
    it('debería resolver todas las alertas activas de un turno', async () => {
      mockPrisma.alertas_triage.updateMany.mockResolvedValue({ count: 2 });

      await service.resolverAlertasPorTurno('turno-1');

      expect(mockPrisma.alertas_triage.updateMany).toHaveBeenCalledWith({
        where: { turno_id: 'turno-1', resuelta: false },
        data: expect.objectContaining({ resuelta: true }),
      });
    });
  });
});