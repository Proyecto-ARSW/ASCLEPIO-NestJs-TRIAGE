import { Test, TestingModule } from '@nestjs/testing';
import { GeneradorNumeroService } from './generador-numero.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TipoTurno } from '../entities/turno.entity';

describe('GeneradorNumeroService', () => {
  let service: GeneradorNumeroService;

  const mockPrisma = {
    turnos: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneradorNumeroService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GeneradorNumeroService>(GeneradorNumeroService);
    jest.clearAllMocks();
  });

  describe('generarNumeroTurno', () => {
    it('debería retornar 1 si no hay turnos previos del día', async () => {
      mockPrisma.turnos.findFirst.mockResolvedValue(null);

      const numero = await service.generarNumeroTurno(1, TipoTurno.URGENCIA);

      expect(numero).toBe(1);
    });

    it('debería retornar numero_turno + 1 si hay turnos previos', async () => {
      mockPrisma.turnos.findFirst.mockResolvedValue({ numero_turno: 12 });

      const numero = await service.generarNumeroTurno(1, TipoTurno.URGENCIA);

      expect(numero).toBe(13);
    });

    it('debería normalizar la fecha a medianoche', async () => {
      mockPrisma.turnos.findFirst.mockResolvedValue(null);

      await service.generarNumeroTurno(1, TipoTurno.URGENCIA, new Date('2026-04-23T14:30:00'));

      const callArgs = mockPrisma.turnos.findFirst.mock.calls[0][0];
      expect(callArgs.where.fecha.getHours()).toBe(0);
      expect(callArgs.where.fecha.getMinutes()).toBe(0);
    });

    it('debería usar fecha actual si no se especifica', async () => {
      mockPrisma.turnos.findFirst.mockResolvedValue(null);
      const antes = new Date();
      antes.setHours(0, 0, 0, 0);

      await service.generarNumeroTurno(1, TipoTurno.URGENCIA);

      const callArgs = mockPrisma.turnos.findFirst.mock.calls[0][0];
      expect(callArgs.where.fecha.toDateString()).toBe(antes.toDateString());
    });
  });
});