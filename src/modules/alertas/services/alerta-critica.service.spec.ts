import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AlertaCriticaService } from './alerta-critica.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AlertaCriticaService', () => {
  let service: AlertaCriticaService;

  const ALERTA_ID = 'alerta-uuid-1234';
  const TURNO_ID = 'turno-uuid-1234';
  const MEDICO_ID = 'medico-uuid-1234';
  const HOSPITAL_ID = 1;

  const mockAlerta = {
    id: ALERTA_ID,
    turno_id: TURNO_ID,
    hospital_id: HOSPITAL_ID,
    nivel_triage: 1,
    tipo_alerta: 'TRIAGE_CRITICO',
    confirmada: false,
    escalada: false,
    activa: true,
    creado_en: new Date(),
    turno: { id: TURNO_ID, pacientes: { id: 'pac-1' }, nivel_triage: { nombre: 'Rojo' } },
  };

  const mockPrisma = {
    alertas_criticas: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    medicos: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertaCriticaService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AlertaCriticaService>(AlertaCriticaService);
    jest.clearAllMocks();
  });

  describe('crearAlerta', () => {
    const dto = {
      turno_id: TURNO_ID,
      hospital_id: HOSPITAL_ID,
      nivel_triage: 1,
      tipo_alerta: 'TRIAGE_CRITICO' as any,
    };

    it('debería crear una nueva alerta si no existe alerta activa', async () => {
      mockPrisma.alertas_criticas.findFirst.mockResolvedValue(null);
      mockPrisma.alertas_criticas.create.mockResolvedValue(mockAlerta);

      const result = await service.crearAlerta(dto);

      expect(result.alerta).toEqual(mockAlerta);
      expect(result.mensaje).toContain('creada');
      expect(mockPrisma.alertas_criticas.create).toHaveBeenCalled();
    });

    it('debería retornar alerta existente si ya hay una activa para el turno', async () => {
      mockPrisma.alertas_criticas.findFirst.mockResolvedValue(mockAlerta);

      const result = await service.crearAlerta(dto);

      expect(result.mensaje).toBe('Alerta ya existente');
      expect(mockPrisma.alertas_criticas.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmarAlerta', () => {
    it('debería confirmar una alerta no confirmada', async () => {
      const alertaConfirmada = { ...mockAlerta, confirmada: true, activa: false };
      mockPrisma.alertas_criticas.findUnique.mockResolvedValue(mockAlerta);
      mockPrisma.alertas_criticas.update.mockResolvedValue(alertaConfirmada);

      const result = await service.confirmarAlerta({ alerta_id: ALERTA_ID, medico_id: MEDICO_ID });

      expect(result.confirmada).toBe(true);
      expect(result.activa).toBe(false);
      expect(mockPrisma.alertas_criticas.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ confirmada: true, activa: false, confirmada_por: MEDICO_ID }),
        }),
      );
    });

    it('debería retornar la alerta sin modificar si ya fue confirmada', async () => {
      const alertaYaConfirmada = { ...mockAlerta, confirmada: true };
      mockPrisma.alertas_criticas.findUnique.mockResolvedValue(alertaYaConfirmada);

      const result = await service.confirmarAlerta({ alerta_id: ALERTA_ID, medico_id: MEDICO_ID });

      expect(result.confirmada).toBe(true);
      expect(mockPrisma.alertas_criticas.update).not.toHaveBeenCalled();
    });
  });

  describe('obtenerPorId', () => {
    it('debería retornar la alerta si existe', async () => {
      mockPrisma.alertas_criticas.findUnique.mockResolvedValue(mockAlerta);

      const result = await service.obtenerPorId(ALERTA_ID);

      expect(result).toEqual(mockAlerta);
    });

    it('debería lanzar NotFoundException si la alerta no existe', async () => {
      mockPrisma.alertas_criticas.findUnique.mockResolvedValue(null);

      await expect(service.obtenerPorId('id-inexistente')).rejects.toThrow(NotFoundException);
      await expect(service.obtenerPorId('id-inexistente')).rejects.toThrow('Alerta no encontrada');
    });
  });

  describe('obtenerAlertasActivas', () => {
    it('debería retornar alertas activas del hospital', async () => {
      mockPrisma.alertas_criticas.findMany.mockResolvedValue([mockAlerta]);

      const result = await service.obtenerAlertasActivas(HOSPITAL_ID);

      expect(result).toHaveLength(1);
      expect(mockPrisma.alertas_criticas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hospital_id: HOSPITAL_ID, activa: true } }),
      );
    });
  });

  describe('obtenerAlertasPendientesEscalamiento', () => {
    it('debería retornar alertas sin confirmar, sin escalar, con más de 3 min de antigüedad', async () => {
      mockPrisma.alertas_criticas.findMany.mockResolvedValue([mockAlerta]);

      const result = await service.obtenerAlertasPendientesEscalamiento();

      expect(result).toHaveLength(1);
      expect(mockPrisma.alertas_criticas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ confirmada: false, escalada: false, activa: true }),
        }),
      );
    });
  });

  describe('desactivarAlerta', () => {
    it('debería desactivar todas las alertas activas del turno', async () => {
      mockPrisma.alertas_criticas.updateMany.mockResolvedValue({ count: 1 });

      await service.desactivarAlerta(TURNO_ID);

      expect(mockPrisma.alertas_criticas.updateMany).toHaveBeenCalledWith({
        where: { turno_id: TURNO_ID, activa: true },
        data: { activa: false },
      });
    });
  });
});