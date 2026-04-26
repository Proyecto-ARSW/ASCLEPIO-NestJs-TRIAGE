import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ColaService } from './cola.service';
import { RedisService } from './redis.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ColaService', () => {
  let service: ColaService;

  const TURNO_ID = 'turno-uuid-1234';
  const HOSPITAL_ID = 1;
  const NIVEL = 3;

  const mockTurno = {
    id: TURNO_ID,
    numero_turno: 5,
    paciente_id: 'pac-1',
    hospital_id: HOSPITAL_ID,
    creado_en: new Date('2026-04-23T08:00:00'),
    pacientes: { id: 'pac-1', usuario_id: 'user-1' },
    nivel_triage: { id: NIVEL, nombre: 'Amarillo' },
  };

  const mockRedis = {
    zadd: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(1),
    zrank: jest.fn(),
    zrange: jest.fn(),
    hmset: jest.fn().mockResolvedValue('OK'),
    hgetall: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    publish: jest.fn().mockResolvedValue(1),
  };

  const mockPrisma = {
    turnos: { findUnique: jest.fn() },
    hospitales: { findUnique: jest.fn() },
    pacientes: { findUnique: jest.fn() },
    usuarios: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColaService,
        { provide: RedisService, useValue: mockRedis },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ColaService>(ColaService);
    jest.clearAllMocks();
  });

  describe('agregarACola', () => {
    it('debería agregar el turno al sorted set de Redis y retornar posición', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(mockTurno);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.zrank.mockResolvedValue(2);
      mockRedis.publish.mockResolvedValue(1);

      const posicion = await service.agregarACola(TURNO_ID, HOSPITAL_ID, NIVEL);

      expect(posicion).toBe(2);
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        `hospital:${HOSPITAL_ID}:cola:triage:${NIVEL}`,
        expect.any(Number),
        TURNO_ID,
      );
      expect(mockRedis.hmset).toHaveBeenCalledWith(
        `turno:${TURNO_ID}`,
        expect.objectContaining({ turno_id: TURNO_ID, nivel_triage: NIVEL.toString() }),
      );
    });

    it('debería lanzar NotFoundException si el turno no existe', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(null);

      await expect(service.agregarACola(TURNO_ID, HOSPITAL_ID, NIVEL)).rejects.toThrow(NotFoundException);
    });

    it('debería marcar alerta_critica como true para niveles 1 y 2', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(mockTurno);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zrank.mockResolvedValue(0);
      mockRedis.publish.mockResolvedValue(1);

      await service.agregarACola(TURNO_ID, HOSPITAL_ID, 1);

      expect(mockRedis.hmset).toHaveBeenCalledWith(
        `turno:${TURNO_ID}`,
        expect.objectContaining({ alerta_critica: 'true' }),
      );
    });

    it('debería marcar alerta_critica como false para niveles 3+', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(mockTurno);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zrank.mockResolvedValue(0);
      mockRedis.publish.mockResolvedValue(1);

      await service.agregarACola(TURNO_ID, HOSPITAL_ID, 4);

      expect(mockRedis.hmset).toHaveBeenCalledWith(
        `turno:${TURNO_ID}`,
        expect.objectContaining({ alerta_critica: 'false' }),
      );
    });
  });

  describe('removerDeCola', () => {
    it('debería remover el turno del sorted set y su metadata', async () => {
      mockRedis.zrem.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.publish.mockResolvedValue(1);

      await service.removerDeCola(TURNO_ID, HOSPITAL_ID, NIVEL);

      expect(mockRedis.zrem).toHaveBeenCalledWith(
        `hospital:${HOSPITAL_ID}:cola:triage:${NIVEL}`,
        TURNO_ID,
      );
      expect(mockRedis.del).toHaveBeenCalledWith(`turno:${TURNO_ID}`);
    });
  });

  describe('obtenerPosicionEnCola', () => {
    it('debería retornar la posición del turno en la cola', async () => {
      mockRedis.zrank.mockResolvedValue(4);

      const posicion = await service.obtenerPosicionEnCola(TURNO_ID, HOSPITAL_ID, NIVEL);

      expect(posicion).toBe(4);
      expect(mockRedis.zrank).toHaveBeenCalledWith(
        `hospital:${HOSPITAL_ID}:cola:triage:${NIVEL}`,
        TURNO_ID,
      );
    });

    it('debería retornar null si el turno no está en la cola', async () => {
      mockRedis.zrank.mockResolvedValue(null);

      const posicion = await service.obtenerPosicionEnCola(TURNO_ID, HOSPITAL_ID, NIVEL);

      expect(posicion).toBeNull();
    });
  });

  describe('obtenerColaPorHospital', () => {
    it('debería lanzar NotFoundException si el hospital no existe', async () => {
      mockPrisma.hospitales.findUnique.mockResolvedValue(null);

      await expect(service.obtenerColaPorHospital(999)).rejects.toThrow(NotFoundException);
    });

    it('debería retornar estructura de cola por hospital', async () => {
      mockPrisma.hospitales.findUnique.mockResolvedValue({ id: HOSPITAL_ID, nombre: 'Hospital Central' });
      mockRedis.zrange.mockResolvedValue([]);

      const result = await service.obtenerColaPorHospital(HOSPITAL_ID);

      expect(result.hospital_id).toBe(HOSPITAL_ID);
      expect(result.hospital_nombre).toBe('Hospital Central');
      expect(result.niveles).toBeDefined();
      expect(Object.keys(result.niveles)).toHaveLength(5);
    });
  });

  describe('obtenerSiguienteTurno', () => {
    it('debería retornar null si no hay turnos en cola', async () => {
      mockRedis.zrange.mockResolvedValue([]);

      const result = await service.obtenerSiguienteTurno(HOSPITAL_ID);

      expect(result).toBeNull();
    });

    it('debería retornar el primer turno del nivel más prioritario', async () => {
      mockRedis.zrange
        .mockResolvedValueOnce(['turno-nivel-1']) // nivel 1
        .mockResolvedValue([]);
      const metadata = {
        turno_id: 'turno-nivel-1',
        numero_turno: '1',
        paciente_id: 'pac-1',
        nivel_triage: '1',
        hospital_id: HOSPITAL_ID.toString(),
        ingreso_cola: new Date().toISOString(),
        alerta_critica: 'true',
      };
      mockRedis.hgetall.mockResolvedValue(metadata);

      const result = await service.obtenerSiguienteTurno(HOSPITAL_ID);

      expect(result).not.toBeNull();
      expect(result?.nivel_triage).toBe(1);
    });
  });

  describe('limpiarCola', () => {
    it('debería limpiar todas las claves de la cola del hospital', async () => {
      mockRedis.zrange.mockResolvedValue(['turno-1', 'turno-2']);
      mockRedis.del.mockResolvedValue(1);

      await service.limpiarCola(HOSPITAL_ID);

      // 5 niveles × (zrange + del metadata + del cola)
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});