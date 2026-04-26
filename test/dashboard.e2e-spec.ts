import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { DashboardController } from '../src/modules/dashboard/controllers/dashboard.controller';
import { DashboardPacienteService } from '../src/modules/dashboard/services/dashboard-paciente.service';
import { DashboardRecepcionistaService } from '../src/modules/dashboard/services/dashboard-recepcionista.service';
import { DashboardEnfermeroService } from '../src/modules/dashboard/services/dashboard-enfermero.service';
import { DashboardMedicoService } from '../src/modules/dashboard/services/dashboard-medico.service';
import { DashboardJefeGuardiaService } from '../src/modules/dashboard/services/dashboard-jefe-guardia.service';
import { DashboardAdminService } from '../src/modules/dashboard/services/dashboard-admin.service';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';

const JWT_SECRET = 'test-secret';
const token = (rol: string) => jwt.sign({ id: 'u1', rol }, JWT_SECRET);

describe('Dashboard (e2e)', () => {
  let app: INestApplication;

  const mockPaciente = { obtenerDashboard: jest.fn(), obtenerPosicion: jest.fn() };
  const mockRecepcionista = {
    obtenerDashboard: jest.fn(),
    obtenerTurnosActivos: jest.fn(),
    buscarPaciente: jest.fn(),
  };
  const mockEnfermero = { obtenerDashboard: jest.fn() };
  const mockMedico = { obtenerDashboard: jest.fn() };
  const mockJefeGuardia = { obtenerDashboard: jest.fn() };
  const mockAdmin = { obtenerDashboard: jest.fn() };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardPacienteService, useValue: mockPaciente },
        { provide: DashboardRecepcionistaService, useValue: mockRecepcionista },
        { provide: DashboardEnfermeroService, useValue: mockEnfermero },
        { provide: DashboardMedicoService, useValue: mockMedico },
        { provide: DashboardJefeGuardiaService, useValue: mockJefeGuardia },
        { provide: DashboardAdminService, useValue: mockAdmin },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(JWT_SECRET) } },
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(async () => { await app.close(); });

  describe('GET /dashboard/paciente/:turno_id', () => {
    it('200 - retorna dashboard del paciente', async () => {
      const dashboardData = {
        turno: { numero_turno: 5, estado: 'EN_ESPERA', nivel_triage: 3, posicion_en_cola: 2 },
        tiempo_estimado_espera: 36,
      };
      mockPaciente.obtenerDashboard.mockResolvedValue(dashboardData);

      const res = await request(app.getHttpServer())
        .get('/dashboard/paciente/turno-uuid-1')
        .set('Authorization', `Bearer ${token('PACIENTE')}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.turno.posicion_en_cola).toBe(2);
    });

    it('404 - retorna 404 si el turno no existe', async () => {
      mockPaciente.obtenerDashboard.mockRejectedValue(new NotFoundException('Turno no encontrado'));

      const res = await request(app.getHttpServer())
        .get('/dashboard/paciente/id-inexistente')
        .set('Authorization', `Bearer ${token('PACIENTE')}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /dashboard/paciente/:turno_id/posicion', () => {
    it('200 - retorna posición en cola', async () => {
      mockPaciente.obtenerPosicion.mockResolvedValue({ posicion: 3, total: 10 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/paciente/turno-uuid-1/posicion')
        .set('Authorization', `Bearer ${token('PACIENTE')}`);

      expect(res.status).toBe(200);
      expect(res.body.data.posicion).toBe(3);
      expect(res.body.data.total).toBe(10);
    });
  });

  describe('GET /dashboard/recepcionista/:hospital_id', () => {
    it('200 - retorna dashboard del recepcionista con rol correcto', async () => {
      mockRecepcionista.obtenerDashboard.mockResolvedValue({
        turnos_activos: 15,
        alertas_activas: 2,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/recepcionista/1')
        .set('Authorization', `Bearer ${token('RECEPCIONISTA')}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('401 - rechaza sin autenticación', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/recepcionista/1');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /dashboard/recepcionista/:hospital_id/turnos-activos', () => {
    it('200 - retorna lista de turnos activos con total', async () => {
      const turnos = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];
      mockRecepcionista.obtenerTurnosActivos.mockResolvedValue(turnos);

      const res = await request(app.getHttpServer())
        .get('/dashboard/recepcionista/1/turnos-activos')
        .set('Authorization', `Bearer ${token('RECEPCIONISTA')}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
    });
  });

  describe('POST /dashboard/recepcionista/buscar-paciente', () => {
    it('201 - busca pacientes por criterio', async () => {
      const pacientes = [{ id: 'p1', nombre: 'Juan García' }];
      mockRecepcionista.buscarPaciente.mockResolvedValue(pacientes);

      const res = await request(app.getHttpServer())
        .post('/dashboard/recepcionista/buscar-paciente')
        .set('Authorization', `Bearer ${token('RECEPCIONISTA')}`)
        .send({ criterio: 'Juan García' });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /dashboard/enfermero/:hospital_id', () => {
    it('200 - retorna dashboard del enfermero', async () => {
      mockEnfermero.obtenerDashboard.mockResolvedValue({ pacientes_pendientes: [], metricas: {} });

      const res = await request(app.getHttpServer())
        .get('/dashboard/enfermero/1')
        .set('Authorization', `Bearer ${token('ENFERMERO')}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /dashboard/medico/:hospital_id', () => {
    it('200 - retorna dashboard del médico', async () => {
      mockMedico.obtenerDashboard.mockResolvedValue({ pacientes_asignados: [], alertas: [] });

      const res = await request(app.getHttpServer())
        .get('/dashboard/medico/1')
        .set('Authorization', `Bearer ${token('MEDICO')}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /dashboard/jefe-guardia/:hospital_id', () => {
    it('200 - retorna dashboard del jefe de guardia', async () => {
      mockJefeGuardia.obtenerDashboard.mockResolvedValue({ alertas_escaladas: [], staff_activo: [] });

      const res = await request(app.getHttpServer())
        .get('/dashboard/jefe-guardia/1')
        .set('Authorization', `Bearer ${token('JEFE_GUARDIA')}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /dashboard/admin/:hospital_id', () => {
    it('200 - retorna dashboard administrativo completo', async () => {
      const adminData = {
        kpis: { atendidos: 45, en_sistema: 12 },
        rendimiento_ia: { precision_random_forest: 82.5 },
      };
      mockAdmin.obtenerDashboard.mockResolvedValue(adminData);

      const res = await request(app.getHttpServer())
        .get('/dashboard/admin/1')
        .set('Authorization', `Bearer ${token('ADMIN')}`);

      expect(res.status).toBe(200);
      expect(res.body.data.kpis.atendidos).toBe(45);
    });

    it('401 - rechaza petición sin token', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/admin/1');

      expect(res.status).toBe(401);
    });
  });
});