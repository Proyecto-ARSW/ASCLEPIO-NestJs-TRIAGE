import { Test, TestingModule } from '@nestjs/testing';
import { DashboardMedicoService } from './dashboard-medico.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EstadoTurno } from '../../turnos/entities/turno.entity';

describe('DashboardMedicoService', () => {
  let service: DashboardMedicoService;

  const HOSPITAL_ID = 1;
  const MEDICO_ID = 'medico-db-uuid-1234';

  const makeTurno = (nivel: number, estado: EstadoTurno, opts: Partial<any> = {}) => ({
    id: `turno-${Math.random()}`,
    hospital_id: HOSPITAL_ID,
    numero_turno: Math.floor(Math.random() * 100),
    paciente_id: 'pac-1',
    medico_id: MEDICO_ID,
    nivel_triage_id: nivel,
    estado,
    creado_en: new Date(Date.now() - 60 * 60000),
    llamado_en: opts.llamado_en || null,
    finalizado_en: opts.finalizado_en || null,
    fecha: new Date(),
    pacientes: { id: 'pac-1', usuario_id: 'user-pac-1' },
    nivel_triage: { id: nivel, nombre: 'Nivel ' + nivel },
    registro_triage: null,
    ...opts,
  });

  const mockPrisma = {
    turnos: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    alertas_criticas: { findMany: jest.fn() },
    usuarios: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardMedicoService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardMedicoService>(DashboardMedicoService);
    jest.clearAllMocks();
    mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Dr. Test', apellido: 'Médico' });
  });

  describe('obtenerDashboard', () => {
    it('debería retornar turnos organizados por nivel de prioridad', async () => {
      const turnoNivel1 = makeTurno(1, EstadoTurno.EN_ESPERA);
      const turnoNivel2 = makeTurno(2, EstadoTurno.EN_ESPERA);
      const turnoNivel3 = makeTurno(3, EstadoTurno.EN_CONSULTA);

      mockPrisma.turnos.findMany.mockResolvedValue([turnoNivel1, turnoNivel2, turnoNivel3]);
      mockPrisma.alertas_criticas.findMany.mockResolvedValue([]);

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.por_niveles.nivel_1).toHaveLength(1);
      expect(result.por_niveles.nivel_2).toHaveLength(1);
      expect(result.por_niveles.nivel_3).toHaveLength(1);
      expect(result.por_niveles.nivel_4).toHaveLength(0);
      expect(result.por_niveles.nivel_5).toHaveLength(0);
    });

    it('debería retornar alertas críticas pendientes de confirmación', async () => {
      mockPrisma.turnos.findMany.mockResolvedValue([]);
      const alerta = {
        id: 'alerta-1',
        turno_id: 'turno-1',
        nivel_triage: 1,
        activa: true,
        confirmada: false,
        creado_en: new Date(),
        turno: {
          id: 'turno-1',
          pacientes: { usuario_id: 'user-1' },
          nivel_triage: { id: 1, nombre: 'Rojo' },
        },
      };
      mockPrisma.alertas_criticas.findMany.mockResolvedValue([alerta]);

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.alertas_pendientes).toHaveLength(1);
    });

    it('debería retornar métricas personales cuando se proporciona medicoId', async () => {
      mockPrisma.turnos.findMany.mockResolvedValue([]);
      mockPrisma.alertas_criticas.findMany.mockResolvedValue([]);
      mockPrisma.turnos.count
        .mockResolvedValueOnce(5)  // atendidos hoy
        .mockResolvedValueOnce(1); // en consulta ahora

      const result = await service.obtenerDashboard(HOSPITAL_ID, MEDICO_ID);

      expect(result.metricas_personales.atendidos_hoy).toBe(5);
      expect(result.metricas_personales.en_consulta_ahora).toBe(1);
    });

    it('debería retornar métricas personales en cero cuando no se proporciona medicoId', async () => {
      mockPrisma.turnos.findMany.mockResolvedValue([]);
      mockPrisma.alertas_criticas.findMany.mockResolvedValue([]);

      const result = await service.obtenerDashboard(HOSPITAL_ID);

      expect(result.metricas_personales.atendidos_hoy).toBe(0);
      expect(result.metricas_personales.en_consulta_ahora).toBe(0);
    });

    it('debería calcular tiempo promedio de atención para el médico', async () => {
      const hace120min = new Date(Date.now() - 120 * 60000);
      const hace60min = new Date(Date.now() - 60 * 60000);
      const hace30min = new Date(Date.now() - 30 * 60000);

      const turnoAtendido = makeTurno(3, EstadoTurno.ATENDIDO, {
        llamado_en: hace60min,
        finalizado_en: hace30min,
        creado_en: hace120min,
      });

      mockPrisma.turnos.findMany
        .mockResolvedValueOnce([]) // activos para por_niveles
        .mockResolvedValueOnce([turnoAtendido]); // para calcularMetricasPersonales
      mockPrisma.alertas_criticas.findMany.mockResolvedValue([]);
      mockPrisma.turnos.count
        .mockResolvedValueOnce(1)  // atendidos hoy
        .mockResolvedValueOnce(0); // en consulta ahora

      const result = await service.obtenerDashboard(HOSPITAL_ID, MEDICO_ID);

      expect(result.metricas_personales.tiempo_promedio_atencion).toBeGreaterThanOrEqual(29);
    });
  });
});