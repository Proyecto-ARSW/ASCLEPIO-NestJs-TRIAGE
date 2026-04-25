import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DashboardPacienteService } from './dashboard-paciente.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ColaService } from '../../cola/services/cola.service';
import { EstadoTurno } from '../../turnos/entities/turno.entity';

describe('DashboardPacienteService', () => {
  let service: DashboardPacienteService;

  const TURNO_ID = 'turno-uuid-1234';
  const HOSPITAL_ID = 1;

  const mockTurno = {
    id: TURNO_ID,
    numero_turno: 5,
    hospital_id: HOSPITAL_ID,
    paciente_id: 'pac-1',
    medico_id: null,
    nivel_triage_id: 3,
    estado: EstadoTurno.EN_ESPERA,
    creado_en: new Date(Date.now() - 20 * 60000),
    llamado_en: null,
    finalizado_en: null,
    registro_triage_id: null,
    pacientes: { id: 'pac-1', usuario_id: 'user-pac-1' },
    nivel_triage: { id: 3, nombre: 'Amarillo', color_codigo: '#FFFF00' },
  };

  const mockPrisma = {
    turnos: { findUnique: jest.fn() },
    usuarios: { findUnique: jest.fn() },
    medicos: { findUnique: jest.fn() },
    niveles_triage: { findUnique: jest.fn() },
    registros_triage: { findFirst: jest.fn() },
    confirmaciones_enfermero: { findFirst: jest.fn() },
  };

  const mockCola = {
    obtenerPosicionEnCola: jest.fn(),
    obtenerColaPorNivel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardPacienteService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ColaService, useValue: mockCola },
      ],
    }).compile();

    service = module.get<DashboardPacienteService>(DashboardPacienteService);
    jest.clearAllMocks();
  });

  describe('obtenerDashboard', () => {
    it('debería lanzar NotFoundException si el turno no existe', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(null);

      await expect(service.obtenerDashboard('id-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('debería retornar el dashboard del paciente con posición en cola', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(mockTurno);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Juan', apellido: 'Pérez' });
      mockPrisma.niveles_triage.findUnique.mockResolvedValue({
        id: 3, nombre: 'Amarillo', color_codigo: '#FFFF00',
      });
      mockCola.obtenerPosicionEnCola.mockResolvedValue(2);
      mockCola.obtenerColaPorNivel.mockResolvedValue({ total: 5, items: [] });
      mockPrisma.registros_triage.findFirst.mockResolvedValue(null);
      mockPrisma.confirmaciones_enfermero.findFirst.mockResolvedValue(null);

      const result = await service.obtenerDashboard(TURNO_ID);

      expect(result.turno.numero_turno).toBe(5);
      expect(result.turno.estado).toBe(EstadoTurno.EN_ESPERA);
      expect(result.turno.posicion_en_cola).toBe(3); // posicion + 1
      expect(result.turno.nivel_nombre).toBe('Amarillo');
    });

    it('debería mostrar estado CLASIFICACION_PENDIENTE sin posición en cola', async () => {
      const turnoPendiente = {
        ...mockTurno,
        estado: EstadoTurno.CLASIFICACION_PENDIENTE,
        nivel_triage_id: null,
        nivel_triage: null,
      };
      mockPrisma.turnos.findUnique.mockResolvedValue(turnoPendiente);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Juan', apellido: 'Pérez' });
      mockPrisma.niveles_triage.findUnique.mockResolvedValue(null);
      mockCola.obtenerColaPorNivel.mockResolvedValue({ total: 0, items: [] });
      mockPrisma.registros_triage.findFirst.mockResolvedValue(null);
      mockPrisma.confirmaciones_enfermero.findFirst.mockResolvedValue(null);

      const result = await service.obtenerDashboard(TURNO_ID);

      expect(result.turno.posicion_en_cola).toBe(0);
      expect(result.turno.nivel_nombre).toBe('Pendiente');
    });

    it('debería calcular tiempo de espera en minutos', async () => {
      const turnoHace30min = {
        ...mockTurno,
        creado_en: new Date(Date.now() - 30 * 60000),
      };
      mockPrisma.turnos.findUnique.mockResolvedValue(turnoHace30min);
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);
      mockPrisma.niveles_triage.findUnique.mockResolvedValue({ id: 3, nombre: 'Amarillo', color_codigo: '#FFFF00' });
      mockCola.obtenerPosicionEnCola.mockResolvedValue(1);
      mockCola.obtenerColaPorNivel.mockResolvedValue({ total: 3, items: [] });
      mockPrisma.registros_triage.findFirst.mockResolvedValue(null);
      mockPrisma.confirmaciones_enfermero.findFirst.mockResolvedValue(null);

      const result = await service.obtenerDashboard(TURNO_ID);

      expect(result.turno.tiempo_espera_minutos).toBeGreaterThanOrEqual(29);
    });
  });

  describe('obtenerPosicion', () => {
    it('debería retornar { posicion: 0, total: 0 } si turno no tiene nivel asignado', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue({ ...mockTurno, nivel_triage_id: null });

      const result = await service.obtenerPosicion(TURNO_ID);

      expect(result.posicion).toBe(0);
      expect(result.total).toBe(0);
    });

    it('debería retornar la posición actual + 1', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(mockTurno);
      mockCola.obtenerPosicionEnCola.mockResolvedValue(4);
      mockCola.obtenerColaPorNivel.mockResolvedValue({ total: 10, items: [] });

      const result = await service.obtenerPosicion(TURNO_ID);

      expect(result.posicion).toBe(5); // 4 + 1
      expect(result.total).toBe(10);
    });
  });
});