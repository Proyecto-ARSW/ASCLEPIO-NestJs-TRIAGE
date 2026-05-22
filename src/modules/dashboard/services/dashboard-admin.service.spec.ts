import { Test, TestingModule } from '@nestjs/testing';
import { DashboardAdminService } from './dashboard-admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EstadoTurno } from '../../turnos/entities/turno.entity';

describe('DashboardAdminService', () => {
  let service: DashboardAdminService;

  const HOSPITAL_ID = 1;

  const makeTurno = (estado: EstadoTurno, nivel: number = 3, opts: Partial<any> = {}) => ({
    id: `turno-${Math.random()}`,
    hospital_id: HOSPITAL_ID,
    numero_turno: 1,
    paciente_id: 'pac-1',
    nivel_triage_id: nivel,
    estado,
    creado_en: new Date(Date.now() - 60 * 60000),
    llamado_en: opts.llamado_en || null,
    finalizado_en: opts.finalizado_en || null,
    medico_id: opts.medico_id || null,
    fecha: new Date(),
    ...opts,
  });

  const mockPrisma = {
    turnos: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    confirmaciones_enfermero: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    medicos: { findMany: jest.fn() },
    enfermeros: { findMany: jest.fn() },
    usuarios: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardAdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardAdminService>(DashboardAdminService);
    jest.clearAllMocks();
    mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Test', apellido: 'User' });
  });

  function setupEmptyDashboard() {
    mockPrisma.turnos.findMany.mockResolvedValue([]);
    mockPrisma.turnos.count.mockResolvedValue(0);
    mockPrisma.confirmaciones_enfermero.findMany.mockResolvedValue([]);
    mockPrisma.medicos.findMany.mockResolvedValue([]);
    mockPrisma.enfermeros.findMany.mockResolvedValue([]);
  }

  describe('obtenerDashboard', () => {
    it('debería retornar la estructura completa del dashboard admin', async () => {
      setupEmptyDashboard();

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.kpis).toBeDefined();
      expect(result.tendencia_atendidos).toBeDefined();
      expect(result.distribucion_semanal).toBeDefined();
      expect(result.rendimiento_ia).toBeDefined();
      expect(result.analisis_tiempos).toBeDefined();
      expect(result.analisis_personal).toBeDefined();
    });

    it('debería calcular KPIs correctamente cuando hay turnos atendidos hoy', async () => {
      const hace60min = new Date(Date.now() - 60 * 60000);
      const hace10min = new Date(Date.now() - 10 * 60000);
      const turnosHoy = [
        makeTurno(EstadoTurno.ATENDIDO, 3, { llamado_en: hace10min, creado_en: hace60min }),
        makeTurno(EstadoTurno.ATENDIDO, 2, { llamado_en: hace10min, creado_en: hace60min }),
        makeTurno(EstadoTurno.EN_ESPERA, 3),
      ];

      mockPrisma.turnos.findMany
        .mockResolvedValueOnce(turnosHoy)  // turnosHoy (KPIs)
        .mockResolvedValueOnce([])          // turnosAyer (KPIs)
        .mockResolvedValue([]);             // resto de llamadas
      mockPrisma.turnos.count.mockResolvedValue(0);
      mockPrisma.confirmaciones_enfermero.findMany.mockResolvedValue([]);
      mockPrisma.medicos.findMany.mockResolvedValue([]);
      mockPrisma.enfermeros.findMany.mockResolvedValue([]);

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.kpis.atendidos).toBe(2);
      expect(result.kpis.en_sistema).toBe(1);
      expect(result.kpis.tiempo_promedio).toBeGreaterThan(0);
    });

    it('debería calcular tendencia de 7 días', async () => {
      mockPrisma.turnos.findMany.mockResolvedValue([]);
      mockPrisma.turnos.count.mockResolvedValue(5); // cada día tiene 5 atendidos
      mockPrisma.confirmaciones_enfermero.findMany.mockResolvedValue([]);
      mockPrisma.medicos.findMany.mockResolvedValue([]);
      mockPrisma.enfermeros.findMany.mockResolvedValue([]);

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.tendencia_atendidos).toHaveLength(7);
      expect(result.tendencia_atendidos[0]).toHaveProperty('fecha');
      expect(result.tendencia_atendidos[0]).toHaveProperty('valor');
    });

    it('debería calcular rendimiento de IA con confirmaciones', async () => {
      const confirmaciones = [
        { acepto_sugerencia: true, nivel_sugerido_ia: 3, nivel_final_enfermero: 3, razon_modificacion: null, registro_triage: { nivel_preliminar_isisvoice: 3, hospital_id: HOSPITAL_ID } },
        { acepto_sugerencia: true, nivel_sugerido_ia: 2, nivel_final_enfermero: 2, razon_modificacion: null, registro_triage: { nivel_preliminar_isisvoice: 2, hospital_id: HOSPITAL_ID } },
        { acepto_sugerencia: false, nivel_sugerido_ia: 3, nivel_final_enfermero: 1, razon_modificacion: 'Estado crítico', registro_triage: { nivel_preliminar_isisvoice: 3, hospital_id: HOSPITAL_ID } },
      ];

      mockPrisma.turnos.findMany.mockResolvedValue([]);
      mockPrisma.turnos.count.mockResolvedValue(0);
      mockPrisma.confirmaciones_enfermero.findMany.mockResolvedValue(confirmaciones);
      mockPrisma.medicos.findMany.mockResolvedValue([]);
      mockPrisma.enfermeros.findMany.mockResolvedValue([]);

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      // 2 de 3 confirmaciones aceptadas = 66.67%
      expect(result.rendimiento_ia.precision_random_forest).toBeCloseTo(66.67, 0);
      expect(result.rendimiento_ia.matriz_confusion).toBeDefined();
    });

    it('debería calcular distribución semanal por nivel', async () => {
      const turnosSemana = [
        makeTurno(EstadoTurno.ATENDIDO, 1),
        makeTurno(EstadoTurno.ATENDIDO, 1),
        makeTurno(EstadoTurno.ATENDIDO, 3),
        makeTurno(EstadoTurno.ATENDIDO, 3),
        makeTurno(EstadoTurno.ATENDIDO, 3),
      ];

      mockPrisma.turnos.findMany
        .mockResolvedValueOnce([]) // hoy
        .mockResolvedValueOnce([]) // ayer
        .mockResolvedValueOnce(turnosSemana) // distribución semanal
        .mockResolvedValue([]);
      mockPrisma.turnos.count.mockResolvedValue(0);
      mockPrisma.confirmaciones_enfermero.findMany.mockResolvedValue([]);
      mockPrisma.medicos.findMany.mockResolvedValue([]);
      mockPrisma.enfermeros.findMany.mockResolvedValue([]);

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.distribucion_semanal.nivel_1).toBe(2);
      expect(result.distribucion_semanal.nivel_3).toBe(3);
      expect(result.distribucion_semanal.nivel_1_porcentaje).toBe(40);
    });

    it('debería incluir análisis de personal con productividad de médicos', async () => {
      const hace120min = new Date(Date.now() - 120 * 60000);
      const hace30min = new Date(Date.now() - 30 * 60000);
      const medico = { id: 'med-1', usuario_id: 'user-med-1', activo: true };
      const turnoMedico = makeTurno(EstadoTurno.ATENDIDO, 3, {
        medico_id: 'med-1',
        llamado_en: hace120min,
        finalizado_en: hace30min,
      });

      mockPrisma.turnos.findMany.mockResolvedValue([]);
      mockPrisma.turnos.count.mockResolvedValue(0);
      mockPrisma.confirmaciones_enfermero.findMany.mockResolvedValue([]);
      mockPrisma.medicos.findMany.mockResolvedValue([medico]);
      mockPrisma.enfermeros.findMany.mockResolvedValue([]);
      // Para calcularProductividadMedicos:
      mockPrisma.turnos.findMany
        .mockResolvedValueOnce([]) // KPI hoy
        .mockResolvedValueOnce([]) // KPI ayer
        .mockResolvedValueOnce([]) // distribución
        .mockResolvedValueOnce([]) // analisis tiempos nivel 1..5
        .mockResolvedValueOnce([]) // nivel 2
        .mockResolvedValueOnce([]) // nivel 3
        .mockResolvedValueOnce([]) // nivel 4
        .mockResolvedValueOnce([]) // nivel 5
        .mockResolvedValueOnce([turnoMedico]); // turnos del médico

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.analisis_personal.productividad_medicos).toBeDefined();
    });
  });
});