import { Test, TestingModule } from '@nestjs/testing';
import { DashboardEnfermeroService } from './dashboard-enfermero.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EstadoTurno } from '../../turnos/entities/turno.entity';

describe('DashboardEnfermeroService', () => {
  let service: DashboardEnfermeroService;

  const HOSPITAL_ID = 1;

  const makeTurno = (nivel: number, estado: EstadoTurno, opts: Partial<any> = {}) => ({
    id: `turno-${nivel}-${Math.random()}`,
    hospital_id: HOSPITAL_ID,
    numero_turno: 1,
    paciente_id: 'pac-1',
    nivel_triage_id: nivel,
    estado,
    creado_en: new Date(Date.now() - 30 * 60000),
    llamado_en: opts.llamado_en || null,
    finalizado_en: null,
    actualizado_en: new Date(),
    fecha: new Date(),
    pacientes: { id: 'pac-1', usuario_id: 'user-1' },
    nivel_triage: { id: nivel, nombre: 'Nivel ' + nivel },
    registro_triage: null,
    ...opts,
  });

  const mockPrisma = {
    turnos: { findMany: jest.fn() },
    usuarios: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardEnfermeroService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardEnfermeroService>(DashboardEnfermeroService);
    jest.clearAllMocks();
    mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Test', apellido: 'User' });
  });

  describe('obtenerDashboard', () => {
    it('debería retornar pacientes críticos (niveles 1 y 2 EN_ESPERA)', async () => {
      const critico1 = makeTurno(1, EstadoTurno.EN_ESPERA);
      const critico2 = makeTurno(2, EstadoTurno.EN_ESPERA);
      const normal = makeTurno(3, EstadoTurno.EN_ESPERA);
      // 1ra llamada: criticos (niveles 1,2 EN_ESPERA)
      // 2da llamada: esperando vitales (todos del día)
      // 3ra llamada: esperando confirmacion
      // 4ta+ llamada: ATENDIDOS del día (para métricas)
      mockPrisma.turnos.findMany
        .mockResolvedValueOnce([critico1, critico2])  // críticos
        .mockResolvedValueOnce([critico1, critico2, normal])  // esperando vitales
        .mockResolvedValueOnce([])  // esperando confirmación
        .mockResolvedValueOnce([]);  // atendidos (métricas)

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.criticos).toHaveLength(2);
      expect(result.metricas_dia).toBeDefined();
      expect(result.metricas_dia.total_atendidos).toBe(0);
    });

    it('debería calcular métricas del día correctamente', async () => {
      const hace60min = new Date(Date.now() - 60 * 60000);
      const hace10min = new Date(Date.now() - 10 * 60000);
      const atendido = makeTurno(3, EstadoTurno.ATENDIDO, {
        llamado_en: hace10min,
        creado_en: hace60min,
      });

      mockPrisma.turnos.findMany
        .mockResolvedValueOnce([])  // críticos
        .mockResolvedValueOnce([])  // esperando vitales
        .mockResolvedValueOnce([])  // esperando confirmación
        .mockResolvedValueOnce([atendido]); // atendidos

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.metricas_dia.total_atendidos).toBe(1);
      expect(result.metricas_dia.por_nivel_3).toBe(1);
      expect(result.metricas_dia.tiempo_promedio_espera).toBeGreaterThan(0);
    });

    it('debería retornar turnos esperando confirmación de triage', async () => {
      const esperandoConf = makeTurno(3, EstadoTurno.ESPERANDO_CONFIRMACION);

      mockPrisma.turnos.findMany
        .mockResolvedValueOnce([])  // críticos
        .mockResolvedValueOnce([])  // esperando vitales
        .mockResolvedValueOnce([esperandoConf]) // esperando confirmación
        .mockResolvedValueOnce([]);  // atendidos

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.esperando_confirmacion).toHaveLength(1);
    });

    it('debería retornar estructura vacía cuando no hay pacientes', async () => {
      mockPrisma.turnos.findMany.mockResolvedValue([]);

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.criticos).toHaveLength(0);
      expect(result.esperando_vitales).toHaveLength(0);
      expect(result.esperando_confirmacion).toHaveLength(0);
      expect(result.metricas_dia.total_atendidos).toBe(0);
    });
  });
});