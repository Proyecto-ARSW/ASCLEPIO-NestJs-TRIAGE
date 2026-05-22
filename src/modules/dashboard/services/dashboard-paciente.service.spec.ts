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
    nivel_triage: { id: 3, nombre: 'Amarillo', color_codigo: '#FFFF00', tiempo_max_espera_min: 60 },
  };

  const mockPrisma = {
    turnos: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    usuarios: { findUnique: jest.fn() },
    medicos: { findUnique: jest.fn() },
    niveles_triage: { findUnique: jest.fn() },
    registros_triage: { findFirst: jest.fn() },
    confirmaciones_enfermero: { findFirst: jest.fn() },
  };

  // ColaService está inyectado pero el servicio no lo usa para calcular posición
  const mockCola = {};

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
      mockPrisma.niveles_triage.findUnique.mockResolvedValue({
        id: 3, nombre: 'Amarillo', color_codigo: '#FFFF00', tiempo_max_espera_min: 60,
      });
      // turnosDelante = 2 → posicion = 3
      mockPrisma.turnos.count
        .mockResolvedValueOnce(2)  // turnosDelante (posicion)
        .mockResolvedValueOnce(5)  // totalCola
        .mockResolvedValue(0);     // contarPacientesDelantePorNivel (niveles 1, 2)
      mockPrisma.registros_triage.findFirst.mockResolvedValue(null);
      mockPrisma.confirmaciones_enfermero.findFirst.mockResolvedValue(null);

      const result = await service.obtenerDashboard(TURNO_ID);

      expect(result.turno.numero_turno).toBe(5);
      expect(result.turno.estado).toBe(EstadoTurno.EN_ESPERA);
      expect(result.turno.posicion_en_cola).toBe(3); // turnosDelante + 1 = 2 + 1
      expect(result.turno.total_en_cola).toBe(5);
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
      mockPrisma.niveles_triage.findUnique.mockResolvedValue(null);
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
      mockPrisma.niveles_triage.findUnique.mockResolvedValue({
        id: 3, nombre: 'Amarillo', color_codigo: '#FFFF00', tiempo_max_espera_min: 60,
      });
      mockPrisma.turnos.count.mockResolvedValue(0);
      mockPrisma.registros_triage.findFirst.mockResolvedValue(null);
      mockPrisma.confirmaciones_enfermero.findFirst.mockResolvedValue(null);

      const result = await service.obtenerDashboard(TURNO_ID);

      expect(result.turno.tiempo_espera_minutos).toBeGreaterThanOrEqual(29);
    });

    it('debería incluir historial con datos de registro de triage', async () => {
      const mockRegistro = { creado_en: new Date(Date.now() - 15 * 60000) };
      mockPrisma.turnos.findUnique.mockResolvedValue(mockTurno);
      mockPrisma.niveles_triage.findUnique.mockResolvedValue({
        id: 3, nombre: 'Amarillo', color_codigo: '#FFFF00', tiempo_max_espera_min: 60,
      });
      mockPrisma.turnos.count.mockResolvedValue(0);
      mockPrisma.registros_triage.findFirst.mockResolvedValue(mockRegistro);
      mockPrisma.confirmaciones_enfermero.findFirst.mockResolvedValue(null);

      const result = await service.obtenerDashboard(TURNO_ID);

      const pasos = result.historial.map((h) => h.paso);
      expect(pasos).toContain('Turno creado');
      expect(pasos).toContain('Datos recibidos y clasificados');
    });

    it('debería mostrar datos del médico cuando el turno está EN_CONSULTA', async () => {
      const turnoEnConsulta = {
        ...mockTurno,
        estado: EstadoTurno.EN_CONSULTA,
        medico_id: 'medico-db-id',
        llamado_en: new Date(Date.now() - 10 * 60000),
      };
      mockPrisma.turnos.findUnique.mockResolvedValue(turnoEnConsulta);
      mockPrisma.medicos.findUnique.mockResolvedValue({ id: 'medico-db-id', usuario_id: 'user-med-1', consultorio: 'C3' });
      mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Dr. Carlos', apellido: 'García' });
      mockPrisma.niveles_triage.findUnique.mockResolvedValue({
        id: 3, nombre: 'Amarillo', color_codigo: '#FFFF00', tiempo_max_espera_min: 60,
      });
      mockPrisma.turnos.count.mockResolvedValue(0);
      mockPrisma.registros_triage.findFirst.mockResolvedValue(null);
      mockPrisma.confirmaciones_enfermero.findFirst.mockResolvedValue(null);

      const result = await service.obtenerDashboard(TURNO_ID);

      expect(result.turno.consultorio_asignado).toBe('C3');
      expect(result.turno.medico_asignado).toContain('García');
    });
  });

  describe('obtenerPosicion', () => {
    it('debería retornar { posicion: 0, total: 0 } si turno no tiene nivel asignado', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue({ ...mockTurno, nivel_triage_id: null });

      const result = await service.obtenerPosicion(TURNO_ID);

      expect(result.posicion).toBe(0);
      expect(result.total).toBe(0);
    });

    it('debería retornar { posicion: 0, total: 0 } si el turno no existe', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(null);

      const result = await service.obtenerPosicion(TURNO_ID);

      expect(result.posicion).toBe(0);
      expect(result.total).toBe(0);
    });

    it('debería retornar posicion = turnosDelante + 1 y total correcto', async () => {
      mockPrisma.turnos.findUnique.mockResolvedValue(mockTurno);
      mockPrisma.turnos.count
        .mockResolvedValueOnce(4)  // turnosDelante
        .mockResolvedValueOnce(10); // total

      const result = await service.obtenerPosicion(TURNO_ID);

      expect(result.posicion).toBe(5); // 4 + 1
      expect(result.total).toBe(10);
    });
  });
});